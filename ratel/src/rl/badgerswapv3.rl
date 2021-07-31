pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract BadgerSwapV3 {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    uint constant public Decimals = 10**15;
    uint constant public Fp = 2**16;

    mapping (address => mapping (address => uint)) public publicBalance;

    mapping (address => mapping (address => string)) public estimatedPrice;
    mapping (address => string) public estimatedPriceValue;
    mapping (string => uint) public estimatedPriceCount;

    uint public tradeCnt;

    constructor() public {}

    function publicDeposit(address token, uint amt) payable public {
        address user = msg.sender;
        require(amt > 0);
        if (token == address(0x0)) {
            require(msg.value * Fp == amt * Decimals); // take care: unit conversion
        } else {
            IERC20(token).safeTransferFrom(user, address(this), amt / Fp * Decimals); // take care: unit conversion
        }
        publicBalance[user][token] += amt;
    }

    function secretDeposit(address token, uint amt) public {
        address user = msg.sender;
        require(amt > 0 && publicBalance[user][token] >= amt);
        publicBalance[user][token] -= amt;

        mpc(address user, address token, uint amt) {
            user = user.lower()
            token = token.lower()

            secretBalance = readDB(f'balance_{user}_{token}', int)

            mpcInput(sfix secretBalance, sfix amt)

            secretBalance += amt

            mpcOutput(sfix secretBalance)

            print('**** secretBalance', user, token, secretBalance)
            print('**** key', f'balance_{user}_{token}')
            writeDB(f'balance_{user}_{token}', secretBalance, int)
        }
    }

    function initPool(address token0, address token1, uint sqrtPrice) public {
        require(token0 < token1);

        mpc(address token0, address token1, uint sqrtPrice) {
            _token0 = token0.lower()
            _token1 = token1.lower()

            writeDB(f'sqrtPriceCurrent_{_token0}_{_token1}', sqrtPrice, int)

            initPrice = str(fix_to_float(sqrtPrice) ** 2)
            print('**** initPrice', initPrice, token0, token1)
            set(estimatedPrice, string memory initPrice, address token0, address token1)
        }
    }

    function addLiquidity(address token0, address token1, $uint sqrtPriceLower, $uint sqrtPriceUpper, $uint maxAmt0, $uint maxAmt1) public {
        require(token0 < token1);
        address user = msg.sender;

        mpc(address user, address token0, address token1, $uint sqrtPriceLower, $uint sqrtPriceUpper, $uint maxAmt0, $uint maxAmt1) {
            user = user.lower()
            token0 = token0.lower()
            token1 = token1.lower()

            balance0 = readDB(f'balance_{user}_{token0}', int)
            balance1 = readDB(f'balance_{user}_{token1}', int)
            sqrtPriceCurrent = readDB(f'sqrtPriceCurrent_{token0}_{token1}', int)
            print('**** sqrtPriceCurrent', sqrtPriceCurrent)

            mpcInput(sfix sqrtPriceLower, sfix sqrtPriceUpper, sfix balance0, sfix balance1, sfix maxAmt0, sfix maxAmt1)
                print_ln('**** sqrtPriceLower %s sqrtPriceUpper %s balance0 %s balance1 %s maxAmt0 %s maxAmt1 %s', sqrtPriceLower.reveal(), sqrtPriceUpper.reveal(), balance0.reveal(), balance1.reveal(), maxAmt0.reveal(), maxAmt1.reveal())
                validSqrtPrice = sqrtPriceLower < sqrtPriceUpper
                enough0 = balance0 >= maxAmt0
                enough1 = balance1 >= maxAmt1
                positive0 = maxAmt0 > 0
                positive1 = maxAmt1 > 0
                validOrder = (validSqrtPrice * enough0 * enough1 * positive0 * positive1).reveal()
                print_ln('**** validOrder %s', validOrder.reveal())
            mpcOutput(cint validOrder)
            print('**** validOrder', validOrder)
            if validOrder == 0:
                continue

            mpcInput(sfix sqrtPriceCurrent, sfix sqrtPriceLower, sfix sqrtPriceUpper, sfix balance0, sfix balance1, sfix maxAmt0, sfix maxAmt1)
                left = sqrtPriceCurrent < sqrtPriceLower
                right = sqrtPriceCurrent > sqrtPriceUpper
                mid = 1 - left - right
                print_ln('**** left %s right %s mid %s', left.reveal(), right.reveal(), mid.reveal())

                actualSqrtPriceLower = sqrtPriceLower * left + sqrtPriceCurrent * mid + sqrtPriceUpper * right
                amt0 = maxAmt0 / (1 / actualSqrtPriceLower - 1 / sqrtPriceUpper)
                print_ln('**** actualSqrtPriceLower %s amt0 %s', actualSqrtPriceLower.reveal(), amt0.reveal())

                actualSqrtPriceUpper = sqrtPriceUpper * right + sqrtPriceCurrent * mid + sqrtPriceLower * left
                amt1 = maxAmt1 / (actualSqrtPriceUpper - sqrtPriceLower)
                print_ln('**** actualSqrtPriceUpper %s amt1 %s', actualSqrtPriceUpper.reveal(), amt1.reveal())

                cmp = amt0 < amt1
                print_ln('**** cmp %s', cmp.reveal())

                liquidity = (1 - mid) * (amt0 + amt1) + mid * (cmp * amt0 + (1 - cmp) * amt1)
                print_ln('**** liquidity %s', liquidity.reveal())

                balance0 -= ((1 - mid) * maxAmt0 + mid * (cmp * maxAmt0 + (1 - cmp) * maxAmt0 * amt1 / amt0))
                print_ln('**** balance0 %s', balance0.reveal())
                balance1 -= ((1 - mid) * maxAmt1 + mid * (cmp * maxAmt1 * amt0 / amt1 + (1 - cmp) * maxAmt1))
                print_ln('**** balance1 %s', balance1.reveal())

            mpcOutput(sfix liquidity, sfix balance0, sfix balance1)

            writeDB(f'balance_{user}_{token0}', balance0, int)
            writeDB(f'balance_{user}_{token1}', balance1, int)

            tickList = readDB(f'tickList_{token0}_{token1}', list)
            print('**** tickList', tickList)

            lower, upper = 0, 0
            for i in range(len(tickList)):
                print('**** tick', tickList[i])
                sqrtPrice, liquidityGross, liquidityNet = tickList[i]
                print('**** sqrtPrice', sqrtPrice, 'liquidityGross', liquidityGross, 'liquidityNet', liquidityNet)

                mpcInput(sfix sqrtPrice, sint liquidityGross, sfix liquidityNet, sfix sqrtPriceLower, sfix sqrtPriceUpper, sfix liquidity, sint lower, sint upper)
                    print_ln('**** sqrtPrice %s sqrtPriceLower %s sqrtPriceUpper %s', sqrtPrice.reveal(), sqrtPriceLower.reveal(), sqrtPriceUpper.reveal())
                    matchLower = sqrtPrice == sqrtPriceLower
                    matchUpper = sqrtPrice == sqrtPriceUpper
                    print_ln('**** matchLower %s matchUpper %s', matchLower.reveal(), matchUpper.reveal())

                    liquidityGross += matchLower + matchUpper
                    liquidityNet += matchLower * liquidity - matchUpper * liquidity
                    print_ln('**** liquidityGross %s liquidityNet %s', liquidityGross.reveal(), liquidityNet.reveal())

                    lower += matchLower
                    upper += matchUpper
                mpcOutput(sint lower, sint upper, sint liquidityGross, sfix liquidityNet)

                tickList[i] = (sqrtPrice, liquidityGross, liquidityNet)

                mpcInput(sint lower, sint upper)
                    lower = lower.reveal()
                    upper = upper.reveal()
                mpcOutput(cint lower, cint upper)

            print('**** lower', lower, 'upper', upper)
            if lower == 0:
                tmpSqrtPrice = sqrtPriceLower
                tmpLiquidityGross = 1
                tmpLiquidityNet = liquidity

                for i in range(len(tickList)):
                    sqrtPrice, liquidityGross, liquidityNet = tickList[i]

                    mpcInput(sfix tmpSqrtPrice, sint tmpLiquidityGross, sfix tmpLiquidityNet, sfix sqrtPrice, sint liquidityGross, sfix liquidityNet)
                        replace = tmpSqrtPrice < sqrtPrice
                        print_ln('**** replace %s', replace.reveal())
                        print_ln('**** tmpSqrtPrice %s tmpLiquidityGross %s tmpLiquidityNet %s sqrtPrice %s liquidityGross %s liquidityNet %s', tmpSqrtPrice.reveal(), tmpLiquidityGross.reveal(), tmpLiquidityNet.reveal(), sqrtPrice.reveal(), liquidityGross.reveal(), liquidityNet.reveal())

                        _sqrtPrice, _liquidityGross, _liquidityNet = tmpSqrtPrice, tmpLiquidityGross, tmpLiquidityNet
                        tmpSqrtPrice, tmpLiquidityGross, tmpLiquidityNet = replace * sqrtPrice + (1 - replace) * tmpSqrtPrice, replace * liquidityGross + (1 - replace) * tmpLiquidityGross, replace * liquidityNet + (1 - replace) * tmpLiquidityNet
                        sqrtPrice, liquidityGross, liquidityNet = replace * _sqrtPrice + (1 - replace) * sqrtPrice, replace * _liquidityGross + (1 - replace) * liquidityGross, replace * _liquidityNet + (1 - replace) * liquidityNet
                        print_ln('**** tmpSqrtPrice %s tmpLiquidityGross %s tmpLiquidityNet %s sqrtPrice %s liquidityGross %s liquidityNet %s', tmpSqrtPrice.reveal(), tmpLiquidityGross.reveal(), tmpLiquidityNet.reveal(), sqrtPrice.reveal(), liquidityGross.reveal(), liquidityNet.reveal())

                    mpcOutput(sfix tmpSqrtPrice, sint tmpLiquidityGross, sfix tmpLiquidityNet, sfix sqrtPrice, sint liquidityGross, sfix liquidityNet)
                    tickList[i] = (sqrtPrice, liquidityGross, liquidityNet)

                tickList.append((tmpSqrtPrice, tmpLiquidityGross, tmpLiquidityNet))

            if upper == 0:
                tmpSqrtPrice = sqrtPriceUpper
                tmpLiquidityGross = 1
                tmpLiquidityNet = -liquidity

                for i in range(len(tickList)):
                    sqrtPrice, liquidityGross, liquidityNet = tickList[i]

                    mpcInput(sfix tmpSqrtPrice, sint tmpLiquidityGross, sfix tmpLiquidityNet, sfix sqrtPrice, sint liquidityGross, sfix liquidityNet)
                        replace = tmpSqrtPrice < sqrtPrice
                        print_ln('**** replace %s', replace.reveal())
                        print_ln('**** tmpSqrtPrice %s tmpLiquidityGross %s tmpLiquidityNet %s sqrtPrice %s liquidityGross %s liquidityNet %s', tmpSqrtPrice.reveal(), tmpLiquidityGross.reveal(), tmpLiquidityNet.reveal(), sqrtPrice.reveal(), liquidityGross.reveal(), liquidityNet.reveal())

                        _sqrtPrice, _liquidityGross, _liquidityNet = tmpSqrtPrice, tmpLiquidityGross, tmpLiquidityNet
                         tmpSqrtPrice, tmpLiquidityGross, tmpLiquidityNet = replace * sqrtPrice + (1 - replace) * tmpSqrtPrice, replace * liquidityGross + (1 - replace) * tmpLiquidityGross, replace * liquidityNet + (1 - replace) * tmpLiquidityNet
                        sqrtPrice, liquidityGross, liquidityNet = replace * _sqrtPrice + (1 - replace) * sqrtPrice, replace * _liquidityGross + (1 - replace) * liquidityGross, replace * _liquidityNet + (1 - replace) * liquidityNet
                        print_ln('**** tmpSqrtPrice %s tmpLiquidityGross %s tmpLiquidityNet %s sqrtPrice %s liquidityGross %s liquidityNet %s', tmpSqrtPrice.reveal(), tmpLiquidityGross.reveal(), tmpLiquidityNet.reveal(), sqrtPrice.reveal(), liquidityGross.reveal(), liquidityNet.reveal())

                    mpcOutput(sfix tmpSqrtPrice, sint tmpLiquidityGross, sfix tmpLiquidityNet, sfix sqrtPrice, sint liquidityGross, sfix liquidityNet)
                    tickList[i] = (sqrtPrice, liquidityGross, liquidityNet)

                tickList.append((tmpSqrtPrice, tmpLiquidityGross, tmpLiquidityNet))

            print('**** tickList', tickList)
            writeDB(f'tickList_{token0}_{token1}', tickList, list)
        }
    }

    function trade(address token0, address token1, $uint amt0, $uint amt1) public {
        require(token0 < token1);
        address user = msg.sender;
        uint tradeSeq = ++tradeCnt;

        mpc(uint tradeSeq, address user, address token0, address token1, $uint amt0, $uint amt1) {
            user = user.lower()
            _token0 = token0.lower()
            _token1 = token1.lower()

            balance0 = readDB(f'balance_{user}_{_token0}', int)
            balance1 = readDB(f'balance_{user}_{_token1}', int)

            mpcInput(sfix amt0, sfix amt1, sfix balance0, sfix balance1)
                validOrder = amt0 * amt1 < 0

                sellToken0 = amt0 > 0
                enoughToken0 = amt0 <= balance0

                sellToken1 = 1 - sellToken0
                enoughToken1 = amt1 <= balance1

                validOrder = (validOrder * (sellToken0 * enoughToken0 + sellToken1 * enoughToken1)).reveal()

                amtIn = sellToken0 * amt0 + sellToken1 * amt1
                print_ln('**** sellToken0 %s sellToken1 %s amtIn %s', sellToken0.reveal(), sellToken1.reveal(), amtIn.reveal())
            mpcOutput(cint validOrder, sint sellToken0, sint sellToken1, sfix amtIn)

            print('**** validOrder', validOrder)
            if validOrder == 0:
                continue

            tickList = readDB(f'tickList_{_token0}_{_token1}', list)
            sqrtPriceCurrent = readDB(f'sqrtPriceCurrent_{_token0}_{_token1}', int)
            print('**** tickList', tickList)

            sqrtPriceCurrentCopy = sqrtPriceCurrent

            deltaToken0, deltaToken1 = 0, 0
            while True:
                liquidityCurrent = 0
                matched = 0
                for i in range(0, len(tickList) - 1):
                    liquidityNet = tickList[i][2]
                    sqrtPriceLower = tickList[i][0]
                    sqrtPriceUpper = tickList[i + 1][0]

                    mpcInput(sfix sqrtPriceLower, sfix sqrtPriceUpper, sfix sqrtPriceCurrent, sint sellToken0, sint sellToken1, sfix deltaToken0, sfix deltaToken1, sfix amtIn, sfix liquidityCurrent, sfix liquidityNet, sint matched)
                        liquidityCurrent += liquidityNet
                        print_ln('**** liquidityCurrent %s', liquidityCurrent.reveal())

                        inRange = (sqrtPriceLower <= sqrtPriceCurrent) * (sqrtPriceUpper >= sqrtPriceCurrent)
                        print_ln('**** inRange %s', inRange.reveal())

                        rest = (amtIn - liquidityCurrent * (sellToken0 * (1 / sqrtPriceLower - 1 / sqrtPriceCurrent) + sellToken1 * (sqrtPriceUpper - sqrtPriceCurrent))) > 0
                        print_ln('**** rest %s', rest.reveal())

                        sqrtPriceNew = rest * (sellToken0 * (sqrtPriceLower - 0.001) + sellToken1 * (sqrtPriceUpper + 0.001)) + (1 - rest) * (sellToken0 * liquidityCurrent * sqrtPriceCurrent / (liquidityCurrent + amtIn * sqrtPriceCurrent) + sellToken1 * (sqrtPriceCurrent + amtIn / liquidityCurrent))
                        print_ln('**** sqrtPriceNew %s', sqrtPriceNew.reveal())

                        _deltaToken0 = inRange * (1 / sqrtPriceNew - 1 / sqrtPriceCurrent) * liquidityCurrent
                        _deltaToken1 = inRange * (sqrtPriceNew - sqrtPriceCurrent) * liquidityCurrent
                        print_ln('**** _deltaToken0 %s _deltaToken1 %s', _deltaToken0.reveal(), _deltaToken1.reveal())

                        deltaToken0 += _deltaToken0
                        deltaToken1 += _deltaToken1
                        sqrtPriceCurrent = inRange * sqrtPriceNew + (1 - inRange) * sqrtPriceCurrent
                        amtIn -= sellToken0 * _deltaToken0 + sellToken1 * _deltaToken1

                        matched += inRange

                        print_ln('**** deltaToken0 %s deltaToken1 %s sqrtPriceCurrent %s amtIn %s', deltaToken0.reveal(), deltaToken1.reveal(), sqrtPriceCurrent.reveal(), amtIn.reveal())

                    mpcOutput(sfix liquidityCurrent, sfix sqrtPriceCurrent, sfix deltaToken0, sfix deltaToken1, sfix amtIn, sint matched)

                mpcInput(sfix amtIn, sint matched)
                    empty = (amtIn <= 0.001).reveal()
                    matched = matched.reveal()
                mpcOutput(cint empty, cint matched)

                print('**** empty', empty)
                if empty == 1 or matched == 0:
                    break

            totalPrice = readDB(f'totalPrice_{_token0}_{_token1}', int)
            totalCnt = readDB(f'totalCnt_{_token0}_{_token1}', int)

            mpcInput(sfix balance0, sfix balance1, sfix deltaToken0, sfix deltaToken1, sint sellToken0, sint sellToken1, sfix amt0, sfix amt1, sfix sqrtPriceCurrentCopy, sfix sqrtPriceCurrent, sfix totalCnt, sfix totalPrice)
                satisfied = (sellToken0 * (deltaToken1 <= amt1) + sellToken1 * (deltaToken0 <= amt0)).reveal()
                print_ln('**** satisfied %s', satisfied.reveal())
                balance0 -= satisfied * deltaToken0
                balance1 -= satisfied * deltaToken1
                print_ln('**** balance0 %s balance1 %s', balance0.reveal(), balance1.reveal())
                print_ln('**** sqrtPriceCurrentCopy %s sqrtPriceCurrent %s', sqrtPriceCurrentCopy.reveal(), sqrtPriceCurrent.reveal())
                sqrtPriceCurrent = (1 - satisfied) * sqrtPriceCurrentCopy + satisfied * sqrtPriceCurrent
                print_ln('**** sqrtPriceCurrent %s', sqrtPriceCurrent.reveal())
                tradePrice = -satisfied * deltaToken1 / deltaToken0
                print_ln('**** tradePrice %s', tradePrice.reveal())

                totalCnt += satisfied
                totalPrice += tradePrice
                print_ln('**** totalCnt %s totalPrice %s', totalCnt.reveal(), totalPrice.reveal())

                batchSize = 2
                batchPrice = sfix(0).reveal()
                if_then(totalCnt.reveal() >= batchSize)
                batchPrice = (totalPrice / totalCnt).reveal()
                print_ln('lalala')
                end_if()
                print_ln('**** batchPrice %s', batchPrice)
            mpcOutput(sfix balance0, sfix balance1, sfix sqrtPriceCurrent, sfix tradePrice, sfix totalCnt, sfix totalPrice, cfix batchPrice)

            writeDB(f'balance_{user}_{_token0}', balance0, int)
            writeDB(f'balance_{user}_{_token1}', balance1, int)
            writeDB(f'sqrtPriceCurrent_{_token0}_{_token1}', sqrtPriceCurrent, int)
            print('****', f'tradePrice_{tradeSeq}')
            writeDB(f'tradePrice_{tradeSeq}', tradePrice, int)
            if batchPrice > 0:
                batchPrice = str(1. * batchPrice / fp)
                print('**** batchPrice', batchPrice)
                set(estimatedPrice, string memory batchPrice, address token0, address token1)
                totalPrice = 0
                totalCnt = 0
            writeDB(f'totalPrice_{_token0}_{_token1}', totalPrice, int)
            writeDB(f'totalCnt_{_token0}_{_token1}', totalCnt, int)
        }
    }
}
