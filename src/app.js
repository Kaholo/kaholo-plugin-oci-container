const { getContainerEngineClient, createOKENetwork, parseMultiAutoComplete, getDefaultAvailabilityDomain, getDefaultImage, getVirtualNetworkClient } = require('./helpers');
const parsers = require("./parsers");
const fs = require("fs");

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
  const compartmentId = parsers.autocomplete(action.params.compartment) || settings.tenancyId;
  const nodeName = parsers.string(action.params.name);
  await client.createNodePool({ createNodePoolDetails: {
    compartmentId,
    name: nodeName,
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
  return {nodePool: (await client.listNodePools({compartmentId, name: nodeName})).items[0]};
}

async function createCluster(action, settings) {
  const client = getContainerEngineClient(settings);
  const compartmentId = parsers.autocomplete(action.params.compartment) || settings.tenancyId;
  const clusterName = parsers.string(action.params.name);
  await client.createCluster({ createClusterDetails: {
    compartmentId,
    name: clusterName,
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
  }})
  const result = {createCluster: await getCluster(action, settings)};
  if (action.params.shape){ // if specified shape then need to create node pool
    try {
      action.params.name = action.params.name + "_nodepool";
      // get cluster id
      action.params.cluster = result.createCluster.cluster.id;
      result.createNodePool = await createNodePool(action, settings);
    }
    catch (error){
      throw {...result, error};
    }
  }
  if (action.params.waitFor){
    const waiters = client.createWaiters();
    result.createCluster = await waiters.forCluster({clusterId: result.createCluster.cluster.id}, "ACTIVE");
  }
  return result;
}

async function createClusterKubeConfig(action, settings) {
  const client = getContainerEngineClient(settings);
  const savePath = parsers.string(action.params.savePath);
  const writeStream = fs.createWriteStream(savePath);
  const kubeFileStream = (await client.createKubeconfig({ 
    clusterId: parsers.autocomplete(action.params.cluster),
    createClusterKubeconfigContentDetails: {
      endpoint: action.params.endpointType,
      tokenVersion: "2.0.0"
    }
  })).value;
  const streamPromise = new Promise(fulfill => {
    kubeFileStream.on('data', function(d){ 
      writeStream.write(d);
    });
    kubeFileStream.on('end', function(){
      writeStream.close();
      fulfill();
    });
  });
  await streamPromise;
  return `KubeConfig file created at ${savePath}`;
}

async function quickCreateCluster(action, settings) {
  const network = await createOKENetwork(action, settings);
  action.params.vcn = network.vcn.id;
  action.params.subnet = network.endpointSubnet.id;
  action.params.publicIp = action.params.publicEndpoint;
  action.params.lbSubnetIds = network.lbSubnet.id;
  action.params.podsCidr = "10.244.0.0/16",
  action.params.servicesCidr = "10.96.0.0/16",
  action.params.image = await getDefaultImage(settings, parsers.autocomplete(action.params.compartment) || settings.tenancyId);
  action.params.availabilityDomains = await getDefaultAvailabilityDomain(settings);
  action.params.subnets = network.nodeSubnet.id;
  try {
    const result = await createCluster(action, settings);
    return {network, ...result};
  } 
  catch (error){
    const client = getVirtualNetworkClient(settings);
    await client.deleteVcn({vcnId: network.vcn.id});
    throw error;
  }
}

async function getCluster(action, settings) {
  const client = getContainerEngineClient(settings);
  if (action.params.name){
    const clusters = (await client.listClusters({
      compartmentId: parsers.autocomplete(action.params.compartment) || settings.tenancyId,
      name: parsers.string(action.params.name)
    })).items;
    if (clusters.length === 0){
      throw "Can't find the cluster";
    } 
    return {cluster: clusters[0]};
  }
  return client.getCluster({clusterId: parsers.autocomplete(action.params.cluster)});
}

module.exports = {
  createNodePool,
  createCluster,
  createClusterKubeConfig,
  quickCreateCluster,
  getCluster,
  ...require("./autocomplete")
}