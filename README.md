# handle subgraph
| Network | Subgraph URL |
| --- | --- |
| Arbitrum one | https://thegraph.com/explorer/subgraph/handle-fi/handle |  
| Arbitrum rinkeby | https://thegraph.com/explorer/subgraph/handle-fi/handle-rinkebyarbitrum |
| Kovan | https://thegraph.com/explorer/subgraph/handle-fi/handle-kovan |

## Subgraph definition file
This subgraph listens for events on the Handle, fxKeeperPool, PCT and oracle contracts.

### Oracles
It is important to note that the chainlink oracle contract that emits events is the aggregator contract, and not the aggregator proxy.
Therefore, only the aggregator contract addresses must be used when listening for oracle events.
The address for the aggregator contract can be fetched if the proxy contract is known, by calling the `aggregator()` function.

#### Arbitrum One
| Oracle | Aggregator Proxy | Aggregator Contract |
| --- | --- | --- |
| ETH_USD | 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612 | 0x3607e46698d218b3a5cae44bf381475c0a5e2ca7 |
| AUD_USD | 0x9854e9a850e7C354c1de177eA953a6b1fba8Fc22 | 0x4258e5d50d737cbbea347f0115ad166e234902d7 |
| PHP_USD | 0xfF82AAF635645fD0bcc7b619C3F28004cDb58574 | 0x5e4c65194f6f33a8bf7e9b95f1d0ca9d611f6d62 |

#### Arbitrum Rinkeby
Note: this deployment uses mock oracles and not real chainlink oracles.

#### Kovan
| Oracle | Aggregator Proxy | Aggregator Contract |
| --- | --- | --- |
| ETH_USD | 0x9326BFA02ADD2366b30bacB125260Af641031331 | 0x10b3c106c4ed7d22b0e7abe5dc43bdfa970a153c |
| AUD_USD | 0x5813A90f826e16dB392abd2aF7966313fc1fd5B8 | 0x8ef23ba9e66168d68b460139178513a3653fab70 |
| EUR_USD | 0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13 | 0x326df4935006469f3d2b20009a25ec79c3a07510 |
| KRW_USD | 0x9e465c5499023675051517E9Ee5f4C334D91e369 | 0xc8b946afc5e38c7067d0425115208d5925aa067d |
| BTC_ETH | 0xF7904a295A029a3aBDFFB6F12755974a958C7C25 | 0x222d3bd9bc8aef87afa9c8e4c7468da3f2c7130d |
| DAI_ETH | 0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541 | 0x30fde1d82a4e58e579a64dbbcd8d4650805cf3c8 |

## Deployment workflow
1. Run `yarn prepare:kovan`, `yarn prepare:local` or `yarn prepare:mainnet` to generate the source files with the proper addresses from the templates based on the network of the deployment.  
2. Run `yarn codegen` to generate the types for the GraphQL schema and contract ABIs.  
3. Run `yarn build` to build the subgraph WASM module.  
4. If this is the first deployment, run `yearn create:kovan`, `yarn create:local` or `yarn create:mainnet` to initialise the remote subgraph indexer, otherwise skip to 5.  
5. Run `yarn deploy:kovan`, `yarn deploy:local` or `yarn deploy:mainnet` to deploy the subgraph to the desired network.  

## Running locally
Take a look at the [graph-node README.md](https://github.com/graphprotocol/graph-node) for instructions on how to run a graph node locally. Requirements are postgres, rust and ipfs.  
With hardhat, the start command would look like this:
```
cargo run -p graph-node --release -- \
    --postgres-url postgresql://USERNAME[:PASSWORD]@localhost:5432/graph-node \
    --ethereum-rpc hardhat:http://localhost:8545 \
    --ipfs 127.0.0.1:5001
```
Ensure that the `graph-node` database is always clean (i.e. delete and recreate it) after restarting the local blockchain, otherwise indexing will fail.

## Self-hosted subgraph
If not deploying to the hosted service provided by The Graph's network, check out the [docker](./docker) directory.

## Important notes
The `startBlock` value for the different mappings in `subgraph.yaml` can be the block at which the Handle contract was deployed for all mappings except for oracles, otherwise the indexer will fail. The oracle mappings should start at around 50 blocks after the Handle contract was deployed to prevent errors.