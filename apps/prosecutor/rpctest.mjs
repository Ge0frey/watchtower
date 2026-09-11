import { JsonRpcProvider } from 'ethers';
const CANDIDATES = {
  mainnet: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.drpc.org',
    'https://rpc.ankr.com/eth',
    'https://1rpc.io/eth',
    'https://cloudflare-eth.com',
    'https://eth.llamarpc.com',
  ],
  sepolia: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org',
    'https://1rpc.io/sepolia',
  ],
};
for (const [net, urls] of Object.entries(CANDIDATES)) {
  console.log(`\n${net}:`);
  for (const url of urls) {
    const t0 = Date.now();
    try {
      const p = new JsonRpcProvider(url, undefined, { staticNetwork: true });
      const n = await p.getBlockNumber();
      // getLogs is what the scanners actually need - many free nodes block or cap it
      let logsOk = 'logs ok';
      try {
        await p.getLogs({ fromBlock: n - 2, toBlock: n, address: '0x0000000000000000000000000000000000000000' });
      } catch (e) { logsOk = `logs: ${(e.shortMessage ?? e.message).slice(0, 40)}`; }
      console.log(`  OK   ${String(Date.now() - t0).padStart(5)}ms  ${url.padEnd(46)} head ${n}  ${logsOk}`);
    } catch (e) {
      console.log(`  FAIL ${String(Date.now() - t0).padStart(5)}ms  ${url.padEnd(46)} ${(e.shortMessage ?? e.message).slice(0, 50)}`);
    }
  }
}
