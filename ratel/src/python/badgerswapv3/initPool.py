import asyncio

from web3 import Web3
from web3.middleware import geth_poa_middleware

from ratel.src.python.Client import get_inputmasks
from ratel.src.python.deploy import url, parse_contract, appAddress, tokenAddress, ETH, reserveInput, getAccount
from ratel.src.python.utils import fp

def initPool(appContract, token0, token1, price):
    price = int(price * fp)
    idxPrice = reserveInput(web3, appContract, 1, account)[0]
    mask = asyncio.run(get_inputmasks(f'{idxPrice}'))[0]
    maskedPrice = price + mask
    tx_hash = appContract.functions.initPool(token0, token1, idxPrice, maskedPrice).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)

if __name__=='__main__':
    web3 = Web3(Web3.WebsocketProvider(url))

    web3.eth.defaultAccount = web3.eth.accounts[0]
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)

    abi, bytecode = parse_contract('BadgerSwapV3')
    appContract = web3.eth.contract(address=appAddress, abi=abi)

    account = getAccount(web3, f'/opt/poa/keystore/server_0/')
    initPool(appContract, ETH, tokenAddress, 1.5)