import aiohttp_cors
import asyncio
import re

from aiohttp import web
from ratel.src.python.utils import key_inputmask, key_balance, get_value, hex_to_int, key_individual_price


class Server:
    def __init__(self, serverID, db, host, http_port):
        self.serverID = serverID
        self.db = db
        self.host = host
        self.http_port = http_port

    async def http_server(self):
        async def handler_inputmask(request):
            print(f"s{self.serverID} request: {request}")
            mask_idxes = re.split(',', request.match_info.get("mask_idxes"))
            res = ''
            for mask_idx in mask_idxes:
                res += f"{',' if len(res) > 0 else ''}{int.from_bytes(bytes(self.db.Get(key_inputmask(mask_idx))), 'big')}"
            data = {
                "inputmask_shares": res,
            }
            print(f"s{self.serverID} response: {res}")
            return web.json_response(data)

        async def handler_balance(request):
            print(f"s{self.serverID} request: {request}")
            user, token = re.split(",", request.match_info.get("user_token"))
            res = int.from_bytes(bytes(get_value(self.db, key_balance(user.lower(), token))), 'big')
            data = {
                "balance": f"{res}"
            }
            print(f"s{self.serverID} response: {res}")
            return web.json_response(data)

        async def handler_price(request):
            print(f"s{self.serverID} request: {request}")
            trade_seq = request.match_info.get("trade_seq")
            res = ''
            try:
                res = int.from_bytes(bytes(self.db.Get(key_individual_price(trade_seq))), 'big')
            except KeyError:
                pass
            data = {
                "price": f"{res}"
            }
            print(f"s{self.serverID} response: {res}")
            return web.json_response(data)

        app = web.Application()

        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
            )
        })

        resource = cors.add(app.router.add_resource("/inputmasks/{mask_idxes}"))
        cors.add(resource.add_route("GET", handler_inputmask))

        resource = cors.add(app.router.add_resource("/balance/{user_token}"))
        cors.add(resource.add_route("GET", handler_balance))

        resource = cors.add(app.router.add_resource("/price/{trade_seq}"))
        cors.add(resource.add_route("GET", handler_price))

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host=self.host, port=self.http_port)
        await site.start()
        await asyncio.sleep(100 * 3600)