const { getContainerEngineClient, createOKENetwork, parseMultiAutoComplete, getDefaultAvailabilityDomain, getDefaultImage, getVirtualNetworkClient } = require('./helpers');
const parsers = require("./parsers");

async function createNodePool(action, settings) {
  const client = getContainerEngineClient(settings);
  const nsgIds = parseMultiAutoComplete(action.params.nsg);
  const availabilityDomains = parseMultiAutoComplete(action.params.availabilityDomains);
  const subnets = parseMultiAutoComplete(action.params.subnets);
  if (!subnets || subnets.length == 0 || !availabilityDomains || availabilityDomains.length === 0) {
    throw "Must provide at least one node subnet and availability domain for placment config!";
  }
  if (availabilityDomains.length !== subnets.length){
    throw "Node Pool subnets and availability Fomains must be the same size!"
  }
  
  return client.createNodePool({ createNodePoolDetails: {
    compartmentId: parsers.autocomplete(action.params.compartment) || settings.tenancyId,
    name: parsers.string(action.params.name),
    clusterId: parsers.autocomplete(action.params.cluster),
    kubernetesVersion: action.params.kubernetesVersion || "1.19.7",
    nodeShape: parsers.autocomplete(action.params.shape),
    nodeImageName: parsers.autocomplete(action.params.image),
    nodeConfigDetails: {
      size: parsers.number(action.params.nodeCount),
      nsgIds: nsgIds,
      placementConfigs: subnets.map((subnetId, index) => ({
        availabilityDomain: availabilityDomains[index],
        subnetId: subnetId
      }))
    },
    nodeShapeConfig: !action.params.ocpuCount || !action.params.memSize ? undefined : {
      memoryInGBs: parsers.number(action.params.memSize),
      ocpus: parsers.number(action.params.ocpuCount)
    }
  }});
}

async function createCluster(action, settings) {
  const client = getContainerEngineClient(settings);
  const result = {createCluster: await client.createCluster({ createClusterDetails: {
    compartmentId: parsers.autocomplete(action.params.compartment) || settings.tenancyId,
    name: parsers.string(action.params.name),
    kubernetesVersion: action.params.kubernetesVersion || "v1.19.7",
    vcnId: parsers.autocomplete(action.params.vcn),
    endpointConfig: {
      isPublicIpEnabled: parsers.boolean(action.params.publicIp),
      nsgIds: parseMultiAutoComplete(action.params.nsg),
      subnetId: parsers.autocomplete(action.params.subnet),
    },
    options: {
      serviceLbSubnetIds: parsers.array(action.params.lbSubnetIds),
      kubernetesNetworkConfig: {
        podsCidr: parsers.string(action.params.podsCidr),
        servicesCidr: parsers.string(action.params.servicesCidr)
      }
    }
  }})};
  try {
    if (action.params.shape){ // if specified shape then need to create node pool
      action.params.name = action.params.name + "_nodepool";
      // get cluster id
      action.params.cluster = (await client.getWorkRequest({workRequestId: result.createCluster.opcWorkRequestId})).workRequest.resources[0].identifier;
      result.createNodePool = await createNodePool(action, settings);
    }
  }
  catch (error){
    throw {...result, error};
  }
  return result;
}

async function createClusterKubeConfig(action, settings) {
  const client = getContainerEngineClient(settings);
  return client.createKubeconfig({ 
    clusterId: parsers.autocomplete(action.params.cluster),
    createClusterKubeconfigContentDetails: {
      endpoint: action.params.endpointType,
      tokenVersion: "2.0.0"
    }
  });
}

async function quickCreateCluster(action, settings) {
  const network = await createOKENetwork(action, settings);
  action.params.vcn = network.vcn.id;
  action.params.subnet = network.endpointSubnet.id;
  action.params.publicIp = action.params.publicWorkers;
  action.params.lbSubnetIds = network.lbSubnet.id;
  action.params.podsCidr = "10.244.0.0/16",
  action.params.servicesCidr = "10.96.0.0/16",
  action.params.image = getDefaultImage(settings);
  action.params.availabilityDomains = getDefaultAvailabilityDomain(settings);
  action.params.subnets = network.nodeSubnet.id;
  try {
    const result = await createCluster(action, settings);
    return {network, ...result};
  } 
  catch (error){
    const client = getVirtualNetworkClient(settings);
    await client.deleteVcn(network.vcn.id);
    throw error;
  }
}

module.exports = {
  createNodePool,
  createCluster,
  createClusterKubeConfig,
  quickCreateCluster,
  ...require("./autocomplete")
}