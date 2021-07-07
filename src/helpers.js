const common = require("oci-common");
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
  
module.exports = {
    getProvider,
    getContainerEngineClient,
    parseMultiAutoComplete,
    getComputeClient,
    getVirtualNetworkClient
}