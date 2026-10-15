import {createRequire} from 'node:module';
const require=createRequire(new URL('./package.json',import.meta.url));
export const web3=require('@solana/web3.js'),token=require('@solana/spl-token'),bs58=require('bs58').default;
