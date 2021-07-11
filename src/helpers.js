const common = require("oci-common");
const identity = require("oci-identity");
const containerEngine = require("oci-containerengine");
const core = require("oci-core");
const parsers = require("./parsers");

/***
 * @returns {common.SimpleAuthenticationDetailsProvider} OCI Auth Details Provider
 ***/
function getProvider(settings){
  return new common.SimpleAuthenticationDetailsProvider(
      settings.tenancyId,     settings.userId,
      settings.fingerprint,   settings.privateKey,
      null,                   common.Region.fromRegionId(settings.region)
  );
}

/***
 * @returns {containerEngine.ContainerEngineClient} OCI Container Engine Client
 ***/
function getContainerEngineClient(settings){
  const provider = getProvider(settings);
  return new containerEngine.ContainerEngineClient({
    authenticationDetailsProvider: provider
  });
}

/***
 * @returns {core.ComputeClient} OCI Compute Client
 ***/
function getComputeClient(settings){
  const provider = getProvider(settings);
  return new core.ComputeClient({
    authenticationDetailsProvider: provider
  });
}

/***
 * @returns {core.VirtualNetworkClient} OCI Virtual Network Client
 ***/
function getVirtualNetworkClient(settings){
  const provider = getProvider(settings);
  return new core.VirtualNetworkClient({
    authenticationDetailsProvider: provider
  });
}

function parseMultiAutoComplete(param){
  param = parsers.autocomplete(param);
  if (param && !Array.isArray(param)) return [param];
  return param;
}

async function getDefaultAvailabilityDomain(settings){
  const identityClient = await new identity.IdentityClient({
    authenticationDetailsProvider: getProvider(settings)
  });
  return (await identityClient.listAvailabilityDomains({compartmentId: settings.tenancyId})).items[0].name;
}
  
async function createOKENetwork(action, settings){
  const netClient = getVirtualNetworkClient(settings);
  
  const name = parsers.string(action.params.name);
  const randId = Date.now().toString(36);
  const quickName = `quick-${name.substring(0, 6)}-${randId}`;
  const compartmentId = parsers.autocomplete(action.params.compartment) || settings.tenancyId;
  const defServiceCidr = "all-ams-services-in-oracle-services-network";
  const defServiceId = (await netClient.listServices({})).items.filter(service => service.cidrBlock === defServiceCidr)[0].id;
  const createPrivate = !action.params.publicWorkers;
  const isEndpointPublic = action.params.publicEndpoint;
  // create VCN
  let result = await netClient.createVcn({createVcnDetails: {
    compartmentId,
    cidrBlock: "10.0.0.0/16",
    displayName: `oke-vcn-${quickName}`,
    dnsLabel: name.substring(0, 15)
  }});
  const resources = {vcn: result.vcn};
  const vcnId = result.vcn.id;
  // create internet gateway
  result = await netClient.createInternetGateway({createInternetGatewayDetails: {
    compartmentId, vcnId, 
    isEnabled: true,
    displayName: `oke-igw-${quickName}`
  }});
  resources.internetGateway = result.internetGateway;
  if (createPrivate){
    // create NAT gateway
    result = await netClient.createNatGateway({createNatGatewayDetails: {
      compartmentId, vcnId, 
      displayName: `oke-ngw-${quickName}`
    }});
    resources.natGateway = result.natGateway;
    // create Service gateway
    result = await netClient.createServiceGateway({createServiceGatewayDetails: {
      compartmentId, vcnId, 
      displayName: `oke-sgw-${quickName}`,
      services: [{ serviceId: defServiceId }]
    }});
    resources.serviceGateway = result.serviceGateway;
    // Create Private Route Table
    result = await netClient.createRouteTable({createRouteTableDetails: {
      compartmentId, vcnId, 
      displayName: `oke-private-routetable-${quickName}`,    
      routeRules: [
        {
          destination: "0.0.0.0/0",
          networkEntityId: resources.natGateway.id,
          description: "traffic to the internet"
        },
        {
          destination: defServiceCidr,
          destinationType: "SERVICE_CIDR_BLOCK",
          networkEntityId: resources.serviceGateway.id,
          description: "traffic to OCI services"
        }
      ]
    }})
    resources.privateRouteTable = result.routeTable;
  }
  // create Security Lists
  const nodeSeclistRules =  {
    ingress: [
      {
        protocol: "all",
        source: "10.0.10.0/24",
        description: "Allow pods on one worker node to communicate with pods on other worker nodes"
      },
      {
        protocol: "1",
        source: "10.0.0.0/28",
        icmpOptions: {
          type: 3,
          code: 4
        },
        description: "Path discovery"
      },
      {
        protocol: "6",
        source: "10.0.0.0/28",
        description: "TCP access from Kubernetes Control Plane"
      },
      {
        protocol: "6",
        source: "0.0.0.0/0",
        tcpOptions: { destinationPortRange: {min: 22, max: 22}},
        description: "Inbound SSH traffic to worker nodes"
      }
    ],
    egrass: [
      {
        destination: "10.0.10.0/24",
        protocol: "all",
        description: "Allow pods on one worker node to communicate with pods on other worker nodes"
      },
      {
        destination: "10.0.0.0/28",
        protocol: "6",
        tcpOptions: {destinationPortRange: {min: 6443, max: 6443}},
        description: "Access to Kubernetes API Endpoint"
      },
      {
        destination: "10.0.0.0/28",
        protocol: "6",
        tcpOptions: {destinationPortRange: {min: 12250, max: 12250}},
        description: "Kubernetes worker to control plane communication"
      },
      {
        destination: "10.0.0.0/28",
        protocol: "1",
        icmpOptions: {type: 3, code: 4},
        description: "Path discovery"
      },
      {
        destination: defServiceCidr,
        destinationType: "SERVICE_CIDR_BLOCK",
        protocol: "6",
        tcpOptions: {destinationPortRange: {min: 443, max: 443}},
        description: "Allow nodes to communicate with OKE to ensure correct start-up and continued functioning"
      },
      {
        destination: "0.0.0.0/0",
        protocol: "1",
        icmpOptions: {type: 3, code: 4},
        description: "ICMP Access from Kubernetes Control Plane"
      },
      {
        destination: "0.0.0.0/0",
        protocol: "all",
        description: "Worker Nodes access to Internet"
      }
    ]
  }
  const k8sApiEndpointRules =  {
    ingress: [
      {
        protocol: "1",
        source: "10.0.10.0/24",
        icmpOptions: {
          type: 3,
          code: 4
        },
        description: "Path discovery"
      },
      {
        protocol: "6",
        source: "10.0.10.0/24",
        tcpOptions: { destinationPortRange: {min: 12250, max: 12250}},
        description: "Kubernetes worker to control plane communication"
      },
      {
        protocol: "6",
        source: "10.0.10.0/24",
        tcpOptions: { destinationPortRange: {min: 6443, max: 6443}},
        description: "Kubernetes worker to Kubernetes API endpoint communication"
      },
      {
        protocol: "6",
        source: "0.0.0.0/0",
        tcpOptions: { destinationPortRange: {min: 6443, max: 6443}},
        description: "External access to Kubernetes API endpoint"
      }
    ],
    egrass: [
      {
        destination: defServiceCidr,
        destinationType: "SERVICE_CIDR_BLOCK",
        protocol: "6",
        tcpOptions: {destinationPortRange: {min: 443, max: 443}},
        description: "Allow Kubernetes Control Plane to communicate with OKE"
      },
      {
        destination: "10.0.10.0/24",
        protocol: "6",
        description: "All traffic to worker nodes"
      },
      {
        destination: "10.0.10.0/24",
        protocol: "1",
        icmpOptions: {type: 3, code: 4},
        description: "Path discovery"
      }
    ]
  }

  result = await netClient.createSecurityList({createSecurityListDetails: {
    compartmentId, vcnId,
    displayName: `oke-nodeseclist-${quickName}`,
    ingressSecurityRules: nodeSeclistRules.ingress,
    egressSecurityRules: nodeSeclistRules.egrass
  }})
  resources.nodeSecurityList = result.securityList;
  result = await netClient.createSecurityList({createSecurityListDetails: {
    compartmentId, vcnId,
    displayName: `oke-k8sApiEndpoint-${quickName}`,
    ingressSecurityRules: k8sApiEndpointRules.ingress,
    egressSecurityRules: k8sApiEndpointRules.egrass
  }})
  resources.endpointSecurityList = result.securityList;
  // update default security list to lb security list
  netClient.updateSecurityList({
    securityListId: resources.vcn.defaultSecurityListId,
    updateSecurityListDetails: {
      displayName: `oke-svclbseclist-${quickName}`
    }
  });
  // Update public route table
  await netClient.updateRouteTable({
    rtId: resources.vcn.defaultRouteTableId,
    updateRouteTableDetails: {
      displayName: `oke-public-routetable-${quickName}`,  
      routeRules: [{
        networkEntityId: resources.internetGateway.id,
        destination: "0.0.0.0/0",
        description: "traffic to/from internet"
      }]
    }
  });
  // create Subnets
  result = await netClient.createSubnet({createSubnetDetails: {
    compartmentId, vcnId,
    cidrBlock: "10.0.20.0/24",
    dhcpOptionsId: resources.vcn.defaultDhcpOptionsId,
    displayName: `oke-svclbsubnet-${quickName}`,
    routeTableId: resources.vcn.defaultRouteTableId,
    securityListIds: [resources.vcn.defaultSecurityListId],
    dnsLabel: `sub${randId}1`
  }});
  resources.lbSubnet = result.subnet;
  result = await netClient.createSubnet({createSubnetDetails: {
    compartmentId, vcnId,
    cidrBlock: "10.0.10.0/24",
    dhcpOptionsId: resources.vcn.defaultDhcpOptionsId,
    displayName: `oke-nodesubnet-${quickName}`,
    routeTableId: createPrivate ? resources.privateRouteTable.id : resources.vcn.defaultRouteTableId,
    securityListIds: [resources.nodeSecurityList.id],
    dnsLabel: `sub${randId}2`,
    prohibitPublicIpOnVnic: createPrivate
  }});
  resources.nodeSubnet = result.subnet;
  result = await netClient.createSubnet({createSubnetDetails: {
    compartmentId, vcnId,
    cidrBlock: "10.0.0.0/28",
    dhcpOptionsId: resources.vcn.defaultDhcpOptionsId,
    displayName: `oke-k8sApiEndpoint-subnet-${quickName}`,
    routeTableId: resources.vcn.defaultRouteTableId,
    securityListIds: [resources.endpointSecurityList.id],
    dnsLabel: `sub${randId}3`,
    prohibitPublicIpOnVnic: !isEndpointPublic
  }});
  resources.endpointSubnet = result.subnet;
  return resources;
}

module.exports = {
    getProvider,
    getContainerEngineClient,
    parseMultiAutoComplete,
    getComputeClient,
    getVirtualNetworkClient,
    createOKENetwork,
    getDefaultAvailabilityDomain
}