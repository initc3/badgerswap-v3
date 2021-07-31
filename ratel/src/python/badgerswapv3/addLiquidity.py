import asyncio

from web3 import Web3
from web3.middleware import geth_poa_middleware

from ratel.src.python.Client import get_inputmasks
from ratel.src.python.deploy import (
    url,
    parse_contract,
    appAddress,
    tokenAddress,
    ETH,
    reserveInput,
    getAccount,
)
from ratel.src.python.utils import fp


def addLiquidity(appContract, token0, token1, priceLower, priceUpper, maxAmtA, maxAmtB):
    priceLower = int(priceLower * fp)
    priceUpper = int(priceUpper * fp)
    maxAmtA = int(maxAmtA * fp)
    maxAmtB = int(maxAmtB * fp)
    idxPriceLower, idxPriceUpper, idxMaxAmtA, idxMaxAmtB = reserveInput(
        web3, appContract, 4, account
    )
    maskPriceLower, maskPriceUpper, maskMaxAmtA, maskMaxAmtB = asyncio.run(
        get_inputmasks(f"{idxPriceLower},{idxPriceUpper},{idxMaxAmtA},{idxMaxAmtB}")
    )
    maskedPriceLower = priceLower + maskPriceLower
    maskedPriceUpper = priceUpper + maskPriceUpper
    maskedMaxAmtA = maxAmtA + maskMaxAmtA
    maskedMaxAmtB = maxAmtB + maskMaxAmtB
    tx_hash = appContract.functions.addLiquidity(
        token0,
        token1,
        idxPriceLower,
        maskedPriceLower,
        idxPriceUpper,
        maskedPriceUpper,
        idxMaxAmtA,
        maskedMaxAmtA,
        idxMaxAmtB,
        maskedMaxAmtB,
    ).transact()
    web3.eth.wait_for_transaction_receipt(tx_hash)


if __name__ == "__main__":
    web3 = Web3(Web3.WebsocketProvider(url))

    web3.eth.defaultAccount = web3.eth.accounts[0]
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)

    abi, bytecode = parse_contract("BadgerSwapV3")
    appContract = web3.eth.contract(address=appAddress, abi=abi)

    account = getAccount(web3, f"/opt/poa/keystore/server_0/")
    addLiquidity(appContract, ETH, tokenAddress, 1, 2, 10, 10)