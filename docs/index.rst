.. Badgerswap v3 documentation master file, created by
   sphinx-quickstart on Sat Jul 31 00:10:44 2021.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Badgerswap v3
=============

.. danger:: Badgerswap v3 is a **prototype**, started at the `IC3 Blockchain
   Summer Camp 2021 <ic3bsc2021>`_.


Badgerswap v3 **IS A PROTOTYPE** to provide a confidential automated market
maker (AMM). The prototype is based on Uniswap v3, and attempts to prevent
front-running and sandwiching attacks by providing privacy for both traders
and liquidity providers.

Badgerswap v3 uses multi-party computations (MPC) to preserve the privacy
of traders and liquidity providers. The MPC network can viewed as a sidechain
to the Ethereum blockchain. The Ethereum blockchain is used as communication
channel and synchronization mechanism. Traders and liquidity providers can
submit their "secret" trades and positions to the MPC sidechain via the
Ethereum blockchain, which helps secure the availability of the information.
The MPC nodes react to events happening on-chain, and thus be synchronized to
carry out the computations.

Badgerswap v3 uses Ratel, a (prototype) high-level privacy-preserving
programming language which allows developers to program both public and
private computations. The public computations are deployed as a smart contract
on the Ethereum blockchain meanwhile the private computations are deployed to
the MPC sidechain as an MPC program.

.. toctree::
    :maxdepth: 2
    :caption: Contents:

    intro
    background
    ratel
    demo
    challenges
    future
    acks
    refs





Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

.. _ic3bsc2021: https://www.initc3.org/events/2021-07-25-ic3-blockchain-summer-camp
