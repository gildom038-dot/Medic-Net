import os

import discord
import httpx
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()

bot_token = os.getenv("DISCORD_BOT_TOKEN")
api_url = os.getenv("MEDCNET_API_URL", "").rstrip("/")
if not bot_token:
    raise RuntimeError("DISCORD_BOT_TOKEN is required.")
if not api_url.startswith("https://"):
    raise RuntimeError("MEDCNET_API_URL must be the HTTPS /api URL of the Vercel deployment.")

intents = discord.Intents.default()
client = discord.Client(intents=intents)
commands = app_commands.CommandTree(client)


@commands.command(name="medcnet", description="Zeigt den Verbindungsstatus der MEDCNET-API.")
async def medcnet(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    try:
        async with httpx.AsyncClient(timeout=12.0) as session:
            response = await session.get(f"{api_url}/health")
            status = response.json()
    except (httpx.HTTPError, ValueError) as error:
        await interaction.followup.send(f"MEDCNET API nicht erreichbar: {error}", ephemeral=True)
        return

    database = "verbunden" if status.get("databaseConnected") else "nicht verbunden"
    api_state = "bereit" if response.is_success else "nicht bereit"
    await interaction.followup.send(f"MEDCNET API: {api_state} · MongoDB: {database}", ephemeral=True)


@client.event
async def on_ready() -> None:
    await commands.sync()
    print(f"MEDCNET Discord bot connected as {client.user}")


client.run(bot_token)
