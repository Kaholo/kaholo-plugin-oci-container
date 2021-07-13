# kaholo-plugin-oci-container-engine
Kaholo plugin for integration with Oracle Cloud Infrastructure(OCI) Container Engine Service(OKE)

## Settings
1. Private Key (Vault) **Required** - Will be used to authenticate to the OCI API. Can be taken from Identity\Users\YOUR_USER\API keys.
2. User ID (String) **Required** - The OCID of the user to authenticate with.
3. Tenancy ID (String) **Required** - Tenancy OCID. Can be found in user profile.
4. Fingerprint (Vault) **Required** -  Will be used to authenticate to the OCI API. Can be taken from Identity\Users\YOUR_USER\API keys.
5. Region (String) **Required** - Identifier of the region to create the requests in. 

## Method Create Node Pool
Creates a new node pool inside the specified cluster.

### Parameters
1. Compartment (Autocomplete) **Optional** - The OCID of the compartment to create the new repository in. If not specified, will use the tenancy.
2. VCN (Autocomplete) **Optional** - The VCN of the cluster to create the node pool for.
3. Cluster (Autocomplete) **Required** - The Cluster to add the node pool to.
4. Node Pool Name (String) **Required** - The name of the node pool. Must be lowercase and not conatin spaces or special chars.
5. Kubernetes Version (Options) **Optional** - The version of kubernetes to run on this node pool. Possible values are: v1.19.7/v1.18.10/v1.17.13/v1.17.7. Default value is v1.19.7.
6. Node Shape (Autocomplete) **Required** - The Shape to use for nodes in this node pool.
7. Custom Shape OCPUs Count (Integer) **Optional** - The number of OCPUs to use in the shape. Only relevent if specified a shape with configurable stracture.
8. Custom Shape Memory Size(GBs) **Optional** - The size of the memory to use in the shape. Only relevent if specified a shape with configurable stracture.
9. Node Image (Autocomplete) **Required** - The Instance Image to use for nodes in this node pool.
10. Number Of Nodes (Integer) **Required** - The maximum number of nodes in the node pool.
11. Availability Domains (Autocomplete/Array) **Optional** - If specified, place the nodes only in subnets from the specified availability domains. Each availability domain is associated with a subnet from the Subnets Parameter in the matching index. If selected from autocomplete than can only be a single domain. Can be passes as array from code.
12. Subnets (Autocomplete/Array) **Required** - At least one subnet to store the nodes in. If selected from autocomplete than only a single subnet. Also accapts array of subnet OCIDs from code. 

## Method Create Cluster
Creates a new kubernetes cluster, and possibly a node pool for it.

### Parameters
1. Compartment (Autocomplete) **Optional** - The OCID of the compartment to create the new cluster in. If not specified, will use the tenancy.
2. Cluster Name (String) **Required** - The name to give to the new cluster. Can only be composed of lowercase letters and number.
3. Kubernetes Version (Options) **Optional** - The version of kubernetes to run on this cluster. Possible values are: v1.19.7/v1.18.10/v1.17.13/v1.17.7. Default value is v1.19.7.
4. VCN (Autocomplete) **Required** - The VCN of the subnet to create the cluster in.
5. Subnet (Autocomplete) **Required** - The Subnet to create the cluster in.
6. Network Security Groups (Autocomplete) **Optional** - One or more network security group to apply to the cluster. Can pass an array of NSG OCIDs from code to pass muliple values.
7. Assign Public IP (Boolean) **Optional** - Whether the cluster should be assigned a public IP or not. Default is False.
8. Subnet IDs For K8s Load Balancers (Text) **Required** - A list of subnets OCIDs to use for K8s Load Balancer. To enter multiple values seperate each value with a new line.
9. Pods CIDR Block (String) **Optional** - A range of IPv4 Addresses in CIDR notation. Pods in the cluster will be assigned an address from the specified range. If not specified, Will be determined by OCI. 
10. Services CIDR Block (String) **Optional** - A range of IPv4 Addresses in CIDR notation. Services in the cluster will be assigned an address from the specified range. If not specified, Will be determined by OCI. 
11. Node Shape (Autocomplete) **Required To Create Node Pool** - If specified create a new Node Pool for the specified cluster. The Shape to use for nodes in the node pool.
12. Node Image (Autocomplete) **Required To Create Node Pool** - The Instance Image to use for nodes in the node pool.
13. Number Of Nodes (Integer) **Required To Create Node Pool** - The maximum number of nodes in the node pool.
14. Availability Domains (Autocomplete/Array) **Optional** - If specified, place the nodes only in subnets from the specified availability domains. Each availability domain is associated with a subnet from the Subnets Parameter in the matching index. If selected from autocomplete than can only be a single domain. Can be passes as array from code.
15. Subnets (Autocomplete/Array) **Required To Create Node Pool** - At least one subnet to store the nodes in. If selected from autocomplete than only a single subnet. Also accapts array of subnet OCIDs from code. 

## Method Quick Create Cluster
Creates a network to host the cluster in, a new cluster, and a node pool.

### Parameters
1. Compartment (Autocomplete) **Optional** - The OCID of the compartment to create the new cluster in. If not specified, will use the tenancy.
2. Cluster Name (String) **Required** - The name to give to the new cluster. Can only be composed of lowercase letters and number.
3. Kubernetes Version (Options) **Optional** - The version of kubernetes to run on this cluster. Possible values are: v1.19.7/v1.18.10/v1.17.13/v1.17.7. Default value is v1.19.7.
4. Public Endpoint (Boolean) **Optional** - If true make the endpoint public. Else make it private. Default is false.
5. Public Workers (Boolean) **Optional** - If true make the subnet for the node pool public. Else make it private. Default is false.
6. Node Shape (Autocomplete) **Required** - The Shape to use for nodes in the node pool.
7. Number Of Nodes (Integer) **Required** - The maximum number of nodes in the node pool.

## Method Create Cluster KubeConfig
Creates a kubeconfig for the specified cluster.

### Parameters
1. Compartment (Autocomplete) **Required** - The OCID of the compartment of the cluster. If not specified, will use the tenancy.
2. Cluster (Autocomplete) **Required** - The cluster to get it's KubeConfig.
3. Endpoint Type (Options) **Required** - The type of endpoint to connect to in the kube config

## Method Get Cluster
Get back information about a cluster by it's name or id.

### Parameters
1. Compartment (Autocomplete) **Optional** - The OCID of the compartment of the required cluster.
2. Cluster (Autocomplete) **Optional** - The OCID of the required cluster.
3. Cluster Name (String) **Optional** - The Name of the required cluster.

* Must provide cluster from autocomplete(ID) or cluster name.