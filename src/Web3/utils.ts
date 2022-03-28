import Web3 from 'web3';
import { fromWei } from 'web3-utils';

export const etherToWei = (value: number | string, decimals?: number): string => {
  try {
    if (value?.toString() && decimals) {
      const val = value.toString();
      let [whole, fraction] = val.split('.');
      if (!whole) whole = '0';
      if (!fraction) fraction = '0';
      while (fraction.length < decimals) fraction += '0';
      const { toBN } = Web3.utils;
      const wei = toBN(whole)
        .mul(toBN(+`1e${decimals}`))
        .add(toBN(fraction));
      return toBN(wei?.toString())?.toString();
    }
    return Web3.utils.toWei(value?.toString() || '0', 'ether');
  } catch (e) {
    console.error(e);
    return '0';
  }
};

export const weiToEther = (value: number | string, decimals?: number): string => {
  try {
    if (!decimals || decimals === 18) return fromWei(`${value}`, 'ether');
    const { toBN } = Web3.utils;
    const wei = toBN(value);
    const base = toBN(+`1e${decimals}`);
    let fraction = wei
      .mod(base)
      ?.toString(10)
      .split('')
      .filter(digit => digit !== '-')
      .join('');
    while (fraction.length < decimals) fraction = '0' + fraction;
    const ethers = `${wei.div(base)?.toString()}${fraction === '0' ? '' : '.' + fraction}`;
    return ethers.replace(/(\.\d*?[1-9])0+$/g, '$1');
  } catch (e) {
    console.error(e);
    return '0';
  }
};