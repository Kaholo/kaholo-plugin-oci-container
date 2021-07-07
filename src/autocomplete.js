const { Cluster } = require("oci-containerengine/lib/model");
const core = require("oci-core")
const identity = require("oci-identity");
const { getProvider, getVirtualNetworkClient, getComputeClient, getContainerEngineClient } = require('./helpers');
const parsers = require("./parsers")

// auto complete helper methods

function mapAutoParams(autoParams){
  const params = {};
  autoParams.forEach(param => {
    params[param.name] = parsers.autocomplete(param.value);
  });
  return params;
}


/***
 * @returns {[{id, value}]} filtered result items
 ***/
function handleResult(result, query, specialKey){
  let items = result.items;
  if (items.length === 0) return [];
  items = items.map(item => ({
    id: specialKey ? item[specialKey] : item.id,
    value:  specialKey ? item[specialKey] : 
            item.displayName ? item.displayName : 
            item.name ? item.name : item.id
  }));

  if (!query) return items;
  query = query.split(" ");
  return items.filter(item => query.every(qWord => 
    item.value.toLowerCase().includes(qWord.toLowerCase())
  ));
}

// main auto complete methods

async function listCompartments(query, pluginSettings) {
  const settings = mapAutoParams(pluginSettings);
  const tenancyId = settings.tenancyId;
  const provider = getProvider(settings);
  const identityClient = await new identity.IdentityClient({
    authenticationDetailsProvider: provider
  });
  const request = { compartmentId: tenancyId };
  const result = await identityClient.listCompartments(request);
  const compartments = handleResult(result, query);
  compartments.push({id: tenancyId, value: "Tenancy"});
  return compartments;
}

async function listAvailabilityDomains(query, pluginSettings) {
  /**
   * This method will return all availability domains
   */
   const settings = mapAutoParams(pluginSettings);
   const provider = getProvider(settings);
   const identityClient = await new identity.IdentityClient({
     authenticationDetailsProvider: provider
   });
  const result = await identityClient.listAvailabilityDomains({compartmentId: settings.tenancyId});
  return handleResult(result, query, "name");
}

async function listShapes(query, pluginSettings, pluginActionParams) {
  
    /**
     * This method will return all shapes domains
     * Must have compartmentId,availabilityDomain before
     */
  const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);

  const computeClient = getComputeClient(settings);
  
  const result = await computeClient.listShapes({
    compartmentId: params.compartment || settings.tenancyId
  });
  return handleResult(result, query, "shape");
}

async function listImages(query, pluginSettings, pluginActionParams) {
    /**
     * This method will return all shapes domains
     * Must have compartmentId,availabilityDomain before
     */
    const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);
    const compartmentId = params.compartment || settings.tenancyId;
    const shape = params.shape;
    const computeClient = getComputeClient(settings);

    const request = {compartmentId, shape};
    const result = await computeClient.listImages(request);
    return handleResult(result, query);
}

async function listVCN(query, pluginSettings, pluginActionParams) {
    /**
     * This method will return all VCN
     */
    const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);
    const compartmentId = params.compartment || settings.tenancyId;
    const provider = getProvider(settings);
    const virtualNetworkClient = new core.VirtualNetworkClient({
      authenticationDetailsProvider: provider
    });
 
    const request = {compartmentId};
    const result = await virtualNetworkClient.listVcns(request);
    return handleResult(result, query);
}

async function listSubnets(query, pluginSettings, pluginActionParams) {
  /**
   * This method will return all subnets in the specified VCN
   */
  const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);
  const compartmentId = params.compartment || settings.tenancyId;
  const virtualNetworkClient = getVirtualNetworkClient(settings);
  const result = await virtualNetworkClient.listSubnets({
    compartmentId,
    vcnId: params.vcn
  });
  return handleResult(result, query);
}

async function listSubnetsForNodePools(query, pluginSettings, pluginActionParams) {
  /**
   * This method will return all Subnets from the specified availability domain
   */
  const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);
  const compartmentId = params.compartment || settings.tenancyId;
  if (!compartmentId || !params.availabilityDomains) throw "Must provide compartment and an availability domain";
  const virtualNetworkClient = getVirtualNetworkClient(settings);
  const result = await virtualNetworkClient.listSubnets({
    compartmentId
  });
  result.items = result.items.filter(subnet => subnet.availabilityDomain === params.availabilityDomains);
  return handleResult(result, query);
}

async function listNSGs(query, pluginSettings, pluginActionParams) {
  /**
   * This method will return all network security groups in the specified vcn
   */
  const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);
  const compartmentId = params.compartment || settings.tenancyId;
  const virtualNetworkClient = getVirtualNetworkClient(settings);
  const result = await virtualNetworkClient.listNetworkSecurityGroups({
    compartmentId,
    vcnId: params.vcn
  });
  return handleResult(result, query);
}

async function listClusters(query, pluginSettings, pluginActionParams) {
  /**
   * This method will return all clusters in the specified compartment and VCN
   */
  const settings = mapAutoParams(pluginSettings), params = mapAutoParams(pluginActionParams);
  const compartmentId = params.compartment || settings.tenancyId;
  const client = getContainerEngineClient(settings);
  const result = await client.listClusters({compartmentId});
  if (params.vcn){
    result.items = result.items.filter(cluster => cluster.vcnId === params.vcn);
  }
  return handleResult(result, query);
  
}

module.exports = {
  listAvailabilityDomains,
  listShapes,
  listImages,
  listCompartments,
  listVCN,
  listSubnets,
  listSubnetsForNodePools,
  listClusters,
  listNSGs
}
