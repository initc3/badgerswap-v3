const p = BigInt('52435875175126190479447740508185965837690552500527637822603658699938581184513')
const n = 4
const t = 1
const fp = 1 << 16

const ethAddr = '0x0000000000000000000000000000000000000000'
const hbsAddr = '0xf74eb25ab1785d24306ca6b3cbff0d0b0817c5e2'
const hbswapAddr = '0x6b5c9637e0207c72ee1a275b6c3b686ba8d87385'
// const hbswapAddr = '0xbc003e9dffe7306e6e414197267581fd732fe8b4'
// const hbsAddr = "0x78160ee9e55fd81626f98d059c84d21d8b71bfda"
// const daiAddr = "0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa"

const decimals = 10**15
const displayPrecision = 4

// const host = 'https://www.honeybadgerswap.org'
// const basePort = 8080
const host = 'http://localhost'
const basePort = 4000
//
// **** Internal functions ****

function isETH(token) {
    return token == tokenList.get('ETH')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function floatToFix(f) {
    return BigInt(Math.round(f * fp))
}

function fixToFloat(i) {
    return parseFloat(i) / fp
}

function transferValue(x) {
    return BigInt(x) * BigInt(decimals)
}

function getElement(st, idx) {
    return st.slice(2 + idx * 64, 2 + (idx + 1) * 64)
}

function getInt(st, idx) {
    return parseInt('0x' + getElement(st, idx))
}

async function getInputMaskIndexes(num) {
    let tx = await hbswapContract.methods.reserveInput(num).send({from: user})
    data = tx['events']['InputMask']['raw']['data']
    var indexes = []
    for (let i = 0; i < num; i++) {
        indexes.push(getInt(data, i + 2))
    }
    return [indexes, tx]
}

function extended_gcd(a, b) {
    let s = BigInt(0)
    let old_s = BigInt(1)
    let t = BigInt(1)
    let old_t = BigInt(0)
    let r = b
    let old_r = a

    while (r !== BigInt(0)) {
        quotient = ~~(old_r / r);
        [old_r, r] = [r, old_r - quotient * r];
        [old_s, s] = [s, old_s - quotient * s];
        [old_t, t] = [t, old_t - quotient * t];
    }

    return [old_r, old_s, old_t]
}

function mod_reduce(x, p) {
    let r = x % p
    return r >= 0 ? r : r + p
}

function modular_inverse(x, p) {
    let gcd, s, t;
    [gcd, s, t] = extended_gcd(x, p)
    return gcd > 0 ? s : -s
}

function interpolate(t, r, p) {
    let f0 = BigInt(0)
    for (let i = 0; i < t; i++) {
        let f = BigInt(1)
        for (let j = 0; j < t; j++) {
            if (i !== j) {
                f *= mod_reduce((BigInt(0) - BigInt(j + 1)) * modular_inverse(BigInt(i - j), p), p)
            }
        }
        f0 += mod_reduce(r[i] * f, p)
    }
    return mod_reduce(f0, p)
}

function reconstruct(n, t, shares, p) {
    if (shares.length !== n) {
        return false
    }
    value = interpolate(t + 1, shares, p)
    for (let i = t + 2; i < n + 1; i++) {
        _value = interpolate(i, shares, p)
        if (_value != value) {
            return NaN
        }
    }
    return value
}

// **** Fetch secret value from mpc servers ****

async function getSecretBalance(user, token, prefix='') {
    let shares = []
    for (let i = 0; i < n; i++) {
        url = host + ':' + (basePort + i) + '/balance/' + user + ',' + token
        console.log(url)
        const share = (await (await fetch(url, {mode: 'cors'})).json()).balance
        $('#' + prefix + i).text(share)
        shares.push(BigInt(share))
    }
    return fixToFloat(reconstruct(n, t, shares, p))
}

async function getTradePrice(tradeSeq) {
    let shares = []
    for (let i = 0; i < n; i++) {
        url = host + ':' + (basePort + i) + '/price/' + tradeSeq
        console.log(url)
        let share = (await (await fetch(url, {mode: 'cors'})).json()).price
        if (share == '') {
            return ''
        }
        $('#tradePrice' + i).text(share)
        shares.push(BigInt(share))
    }
    return fixToFloat(reconstruct(n, t, shares, p))
}

async function getInputmasks(num, idxes) {
    //Fetch inputmask shares from servers
    let shares = []
    for (let i = 0; i < num; i++) shares.push([])
    for (let srv = 0; srv < n; srv++) {
        url = host + ':' + (basePort + srv) + '/inputmasks/' + idxes
        console.log(url)
        const tmp = (await (await fetch(url, {mode: 'cors'})).json()).inputmask_shares.split(',')
        for (let i = 0; i < num; i++) {
            shares[i].push(BigInt(tmp[i]))
        }
    }

    //Reconstruct inputmasks
    let masks = []
    for (let i = 0; i < num; i++) {
        masks.push(reconstruct(n, t, shares[i], p))
    }

    return masks
}

async function getServerLog(srv, lines) {
    url = host + ':' + (basePort + srv) + '/log/' + lines
    const log = (await (await fetch(url, {mode: 'cors'})).json()).log
    $('#log').text(log)
}

// **** Access values on blockchain ****

async function getPersonalBalance(user, token) {
    let personalBalance
    if (isETH(token)) {
        personalBalance =  await web3.eth.getBalance(user)
    } else {
        personalBalance = await (contractList.get(token)).methods.balanceOf(user).call()
    }
    return parseFloat(personalBalance) / decimals
}

async function getPublicBalance(user, token) {
    return fixToFloat(await hbswapContract.methods.publicBalance(user, token).call())
}

// **** Global functions ****

async function trade() {
    if (!updateTradePair()) {
        return
    }

    const tradeTokenA = tokenList.get($( '#tradeTokenA option:selected' ).text())
    const tradeTokenB = tokenList.get($( '#tradeTokenB option:selected' ).text())

    // Check trading amount is valid
    const amtTradeA = parseFloat($( '#amtTradeFrom' ).val())
    const amtTradeB = parseFloat($( '#amtTradeTo' ).val())

    const balanceA = await getSecretBalance(user, tradeTokenA)
    if (isNaN(amtTradeA) || amtTradeA > balanceA) {
        $('#tradeInfo').text("Error: invalid amount for tokenA!")
        $('#tradeInfo').show()
        return
    }
    const balanceB = await getSecretBalance(user, tradeTokenB)
    if (isNaN(amtTradeB) || amtTradeB > balanceB) {
        $('#tradeInfo').text("Error: invalid amount for tokenB!")
        $('#tradeInfo').show()
        return
    }

    if (amtTradeA * amtTradeB >= 0) {
        $('#tradeInfo').text("Error: invalid amounts!")
        $('#tradeInfo').show()
        return
    }

    $('#tradeStatus').text('Getting inputmasks...')
    $('#tradeStatusNeutral').show()
    let tx
    let idxes
    [idxes, tx] = await getInputMaskIndexes(2)
    $('#tradeIdxes').text(idxes)

    const masks = await getInputmasks(2, idxes)
    $('#tradeMasks').text(masks)

    const slippage = $( '#slippage' ).val()

    // const minReceived = amtTradeB * (1 - slippage)
    //
    // let tokenA, tokenB, valueA, valueB
    // if (tokenA < tradeTokenB) {
    //     tokenA = tokenA
    //     tokenB = tradeTokenB
    //     valueA = -floatToFix(amtTradeA)
    //     valueB = floatToFix(minReceived)
    // } else {
    //     tokenA = tradeTokenB
    //     tokenB = tokenA
    //     valueA = floatToFix(minReceived)
    //     valueB = -floatToFix(amtTradeA)
    // }
    sellTokenA = amtTradeA > 0
    valueA = floatToFix(amtTradeA * (sellTokenA + (1 - sellTokenA) * (1 - slippage)))
    valueB = floatToFix(amtTradeB * (sellTokenA * (1 - slippage) + (1 - sellTokenA)))
    console.log(valueA, valueB)

    const maskedValueA = valueA + masks[0]
    const maskedValueB = valueB + masks[1]
    $('#tradeStatus').text('Submitting trade order...')
    tx = await hbswapContract.methods.trade(tradeTokenA, tradeTokenB, idxes[0], maskedValueA, idxes[1], maskedValueB).send({from: user})

    data = tx['events']['Trade']['raw']['data']
    const tradeSeq = getInt(data, 0)
    $('#seq').text(tradeSeq)
    while (true) {
        const price = await getTradePrice(tradeSeq)
        if (!(typeof price === 'string')) {
            $('#tradeStatusNeutral').hide()
            $('#price').text(price.toFixed(displayPrecision))
            if (price == 0) {
                $('#tradeStatus').text('Trade failed')
                $('#tradeStatusFail').show()
            } else {
                $('#tradeStatus').text('Trade succeed')
                $('#tradeStatusSucceed').show()
            }
            break
        }
        await sleep(5000)
    }

    $('#balanceTradeFrom').text((await getSecretBalance(user, tradeTokenA)).toFixed(displayPrecision))
    $('#balanceTradeTo').text((await getSecretBalance(user, tradeTokenB)).toFixed(displayPrecision))
}

async function deposit() {
    await updateDepositToken()

    const token = tokenList.get($( '#depositToken option:selected' ).text())
    const amt = parseFloat($('#depositAmt').val()) // float

    // Check amt is valid
    const prevPersonalBalance = await getPersonalBalance(user, token)
    if (isNaN(amt) || amt <= 0 || amt > prevPersonalBalance) {
        $('#depositInfo').text("Error: invalid deposit amount!")
        $('#depositInfo').show()
        return
    }

    // Display balances before public deposit
    const prevPublicBalance = await getPublicBalance(user, token)
    const prevSecretBalance = await getSecretBalance(user, token)
    $('#depositBalance').text(prevSecretBalance.toFixed(displayPrecision))
    $('#personalBalance').text(prevPersonalBalance.toFixed(displayPrecision))
    $('#contractBalance').text(prevPublicBalance.toFixed(displayPrecision))
    $('#secretBalance').text(prevSecretBalance.toFixed(displayPrecision))

    // Public deposit
    const fixAmt = floatToFix(amt)
    console.log('fixAmt', fixAmt)
    const transferAmt = transferValue(amt)
    let tx
    if (isETH(token)) {
        $('#depositStatus').text('public depositing...')
        console.log('before')
        tx = await hbswapContract.methods.publicDeposit(token, fixAmt).send({from: web3.eth.defaultAccount, value: Number(transferAmt)})
        console.log('after')
        console.log(tx.hash)
    } else {
        // Approve before token transfer
        $('#depositStatus').text('approving tokens...')
        tx = await contractList.get(token).methods.approve(hbswapAddr, transferAmt).send({from: user})

        $('#depositStatus').text('public depositing...')
        tx = await hbswapContract.methods.publicDeposit(token, fixAmt).send({from: user})
    }

    // Display balances after public deposit
    $('#depositStatus').text('secret depositing...')
    $('#personalBalance').text((await getPersonalBalance(user, token)).toFixed(displayPrecision))
    $('#contractBalance').text((await getPublicBalance(user, token)).toFixed(displayPrecision))

    // Secret deposit
    tx = await hbswapContract.methods.secretDeposit(token, fixAmt).send({from: user})
    // htmlContent += ' <a href="https://kovan.etherscan.io/tx/' + tx["transactionHash"] + '">' + 'secretDeposit' + '</a>'
    // $('#depositTxLink').html(htmlContent)

    let curSecretBalance
    while (true) {
        curSecretBalance = await getSecretBalance(user, token, 'depositUpdate')
        if (!isNaN(curSecretBalance) && prevSecretBalance != curSecretBalance) {
            break
        }
        await sleep(5000)
    }

    // Display balances after secret deposit
    $('#depositBalance').text(curSecretBalance.toFixed(displayPrecision))
    $('#depositStatus').text('done')
    $('#contractBalance').text((await getPublicBalance(user, token)).toFixed(displayPrecision))
    $('#secretBalance').text(curSecretBalance.toFixed(displayPrecision))
}

async function initPool() {
    tokenA = tokenList.get($( '#initTokenA option:selected' ).text())
    tokenB = tokenList.get($( '#initTokenB option:selected' ).text())
    if (tokenA >= tokenB) {
        return
    }

    const initPrice = parseFloat($('#initPrice').val())

    const price = await hbswapContract.methods.estimatedPrice(tokenA, tokenB).call()
    if (price != '') {
        $('#addInfo').text("Error: pool already initiated!")
        $('#addInfo').show()
        return
    }

    if (initPrice <= 0) {
        return
    }

    $('#poolStatus').text("Sending transaction...")

    let tx
    tx = await hbswapContract.methods.initPool(tokenA, tokenB, floatToFix(initPrice)).send({from: user})

    while (true) {
        const price = await hbswapContract.methods.estimatedPrice(tokenA, tokenB).call()
        if (price != '') {
            $('#estPricePool').text(price)
            break
        }
        await sleep(5000)
    }

    $('#poolStatus').text("Done")
}

async function addLiquidity() {
    if (!await updatePoolPair()) return

    const tokenA = tokenList.get($( '#poolTokenA option:selected' ).text())
    const tokenB = tokenList.get($( '#poolTokenB option:selected' ).text())
    const lowerPrice = parseFloat($('#rangeL').val())
    const upperPrice = parseFloat($('#rangeR').val())
    const amtA = parseFloat($('#amtPoolTokenA').val())
    const amtB = parseFloat($('#amtPoolTokenB').val())

    const price = await hbswapContract.methods.estimatedPrice(tokenA, tokenB).call()
    if (price == '') {
        $('#addInfo').text("Error: pool not initiated!")
        $('#addInfo').show()
        return
    }

    const balanceA = await getSecretBalance(user, tokenA)
    if (isNaN(amtA) || amtA <= 0 || amtA > balanceA) {
        $('#addInfo').text("Error: invalid amount for tokenA!")
        $('#addInfo').show()
        return
    }

    const balanceB = await getSecretBalance(user, tokenB)
    if (isNaN(amtB) || amtB <= 0 || amtB > balanceB) {
        $('#addInfo').text("Error: invalid amount for tokenB!")
        $('#addInfo').show()
        return
    }

    $('#poolStatus').text("Getting input masks...")

    let tx
    let idxes
    [idxes, tx] = await getInputMaskIndexes(4)
    $('#poolIdxes').text(idxes)

    const masks = await getInputmasks(4, idxes)
    $('#poolMasks').text(masks)

    $('#poolStatus').text("Sending transaction...")
    const maskedPriceLower = floatToFix(lowerPrice) + masks[0]
    const maskedPriceUpper = floatToFix(upperPrice) + masks[1]
    const maskedAmtA = floatToFix(amtA) + masks[2]
    const maskedAmtB = floatToFix(amtB) + masks[3]
    tx = await hbswapContract.methods.addLiquidity(tokenA, tokenB, idxes[0], maskedPriceLower, idxes[1], maskedPriceUpper, idxes[2], maskedAmtA, idxes[3], maskedAmtB).send({from: user})

    let curBalanceA
    while (true) {
        curBalanceA = await getSecretBalance(user, tokenA)
        if (!isNaN(curBalanceA) && balanceA != curBalanceA) {
            break
        }
        await sleep(5000)
    }

    updatePoolPair()
    $('#poolStatus').text("Done")
}

async function updateTradePair() {
    $('#balanceTradeFrom').empty()
    $('#balanceTradeTo').empty()
    $('#estPriceTrade').empty()
    $('#tradeInfo').empty()
    $('#tradeInfo').hide()
    $('#tradeStatus').empty()
    $('#tradeIdxes').empty()
    $('#tradeMasks').empty()
    $('#seq').empty()
    $('#price').empty()
    $('#tradePrice0').empty()
    $('#tradePrice1').empty()
    $('#tradePrice2').empty()
    $('#tradePrice3').empty()
    $('#tradeStatusNeutral').hide()
    $('#tradeStatusFail').hide()
    $('#tradeStatusSucceed').hide()

    const tradeTokenA = tokenList.get($( '#tradeTokenA option:selected' ).text())
    const tradeTokenB = tokenList.get($( '#tradeTokenB option:selected' ).text())

    if (tradeTokenA == tradeTokenB) {
        $('#tradeInfo').text('Error: invalid token pair!')
        $('#tradeInfo').show()
        return false
    }

    $('#balanceTradeFrom').text((await getSecretBalance(user, tradeTokenA)).toFixed(displayPrecision))
    $('#balanceTradeTo').text((await getSecretBalance(user, tradeTokenB)).toFixed(displayPrecision))

    const price = parseFloat(await hbswapContract.methods.estimatedPrice(tradeTokenA, tradeTokenB).call())
    if (price == '') {
        $('#tradeInfo').text('Error: pool not initiated!')
        $('#tradeInfo').show()
        return false
    }
    $('#estPriceTrade').text(price.toFixed(displayPrecision))

    updateAmtTradeFrom()

    return true
}

async function updateAmtTradeFrom() {
    // const tradeTokenA = tokenList.get($( '#tradeTokenA option:selected' ).text())
    // const tradeTokenB = tokenList.get($( '#tradeTokenB option:selected' ).text())
    //
    // if (tradeTokenA == tradeTokenB) {
    //     $('#tradeInfo').text('Error: invalid token pair!')
    //     $('#tradeInfo').show()
    //     return
    // }
    //
    // const amtTradeFrom = $( '#amtTradeFrom' ).val()
    //
    // let price = await hbswapContract.methods.estimatedPrice(tradeTokenA, tradeTokenB).call()
    //
    // const amtTradeTo = amtTradeFrom * price
    //
    // $('#amtTradeTo').val(amtTradeTo.toFixed(displayPrecision))
}

async function updateAmtTradeTo() {
    // const _fromToken = $( '#tradeFromToken option:selected').text()
    // const fromToken = tokenList.get(_fromToken)
    // const toToken = tokenList.get($( '#tradeToToken option:selected' ).text())
    //
    // if (fromToken == toToken) {
    //     $('#tradeInfo').text('Error: invalid token pair!')
    //     $('#tradeInfo').show()
    //     return
    // }
    //
    // const amtTradeTo = $( '#amtTradeTo' ).val()
    //
    // let price
    // if (fromToken < toToken) {
    //     price = await hbswapContract.methods.estimatedPrice(fromToken, toToken).call()
    // } else {
    //     price = await hbswapContract.methods.estimatedPrice(toToken, fromToken).call()
    //     price = 1. / parseFloat(price)
    // }
    //
    // const amtTradeFrom = amtTradeTo / price
    //
    // $('#amtTradeFrom').val(amtTradeFrom.toFixed(displayPrecision))
}

async function updatePoolPair() {

    // Get pool pair
    const tokenA = tokenList.get($( '#poolTokenA option:selected' ).text())
    const tokenB = tokenList.get($( '#poolTokenB option:selected' ).text())

    $('#balancePoolTokenA').empty()
    $('#balancePoolTokenB').empty()
    $('#estPricePool').empty()
    $('#addInfo').empty()
    $('#addInfo').hide()
    $('#removeInfo').empty()
    $('#removeInfo').hide()
    $('#poolStatus').empty()
    $('#poolIdxes').empty()
    $('#poolMasks').empty()
    $('#poolTxLink').empty()

    if (tokenA >= tokenB) {
        $('#addInfo').text('Error: invalid token pair!')
        $('#addInfo').show()
        $('#removeInfo').text('Error: invalid token pair!')
        $('#removeInfo').show()
        return false
    }

    // Update estimated price
    let price = await hbswapContract.methods.estimatedPrice(tokenA, tokenB).call()
    if (price == '') {
        price = 'Pool not initiated!'
    }

    $('#balancePoolTokenA').text((await getSecretBalance(user, tokenA)).toFixed(displayPrecision))
    $('#balancePoolTokenB').text((await getSecretBalance(user, tokenB)).toFixed(displayPrecision))
    $('#estPricePool').text(price)

    return true
}

async function updateDepositToken() {
    const token = tokenList.get($( '#depositToken option:selected' ).text())
    $('#depositBalance').text((await getSecretBalance(user, token)).toFixed(displayPrecision))
    $('#depositInfo').empty()
    $('#depositInfo').hide()
    // $('#withdrawInfo').empty()
    // $('#withdrawInfo').hide()
    $('#depositStatus').empty()
    $('#personalBalance').empty()
    $('#contractBalance').empty()
    $('#secretBalance').empty()
    $('#depositUpdate0').empty()
    $('#depositUpdate1').empty()
    $('#depositUpdate2').empty()
    $('#depositUpdate3').empty()
    // $('#depositTxLink').empty()
}

// **** Initialization ****

async function init() {
    // window.web3 = new Web3(ethereum)
    window.web3 = new Web3();
    endpoint = 'http://localhost:8545';
    web3.setProvider(new web3.providers.HttpProvider(endpoint));

    //  = (await ethereum.request({ method: 'eth_requestAccounts'}))[0]
    var account = web3.eth.accounts.decrypt({"address":"096f48173c8eb3849bb415f62d3113cb3b90c640","crypto":{"cipher":"aes-128-ctr","ciphertext":"8046cde74e9b011244d23e5fe2fb15eddb8ded7a35a62deb049fa91ce5556a74","cipherparams":{"iv":"e49ee2a471084b5ab35ea9eedf9d935a"},"kdf":"scrypt","kdfparams":{"dklen":32,"n":262144,"p":1,"r":8,"salt":"5f90e83b9307e10a1609f6ff40893c8a5151377ea654ed194e0e6ce41f237213"},"mac":"282821ce65d3dcec6d149159a9f4a9249e415e9f329638c751f5b328e5215a14"},"id":"ea3770d2-6dda-417a-a2c9-1bea0f5cac98","version":3}, "");
    console.log(account)
    window.user = account.address
    /* window.user = web3.eth.accounts.privateKeyToAccount('0xa2452f41d937aa23f2d6be28e953293827f15a6277104c857fdd3373f766745a').address */;
    // console.log(account);
    /* console.log(web3.eth.defaultAccount); */
    web3.eth.defaultAccount = user;
    console.log(web3.eth.defaultAccount);
    $('#user').text(user)

    const hbswapABI = JSON.parse($('#hbswapABI').text())
    window.hbswapContract = new web3.eth.Contract(hbswapABI, hbswapAddr)

    const tokenABI = JSON.parse($('#tokenABI').text())
    window.tokenList = new Map()
    tokenList.set('ETH', ethAddr)
    tokenList.set('HBS', hbsAddr)
    // tokenList.set('DAI', daiAddr)
    window.contractList = new Map()
    for (let [k, v] of tokenList) {
        contractList.set(v, new web3.eth.Contract(tokenABI, v))
    }

    await updateTradePair()
    await updateDepositToken()
    await updatePoolPair()

}

init()