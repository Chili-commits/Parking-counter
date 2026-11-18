# Christmas Farm Visitor Counter

The app has two views: **Parking** for counting arrivals and **Backstage** for a live visitor graph and summary. Both views share data with every device connected to the same local network.

The interface uses a cozy Christmas palette of warm white, evergreen, and berry red, with subtle festive accents in the background.

## Run with Docker

1. Install Docker with the Compose plugin.
2. In this folder, run `docker compose up --build -d`.
3. Open `http://localhost:3000` on this computer. On phones and other computers on the same Wi-Fi, open `http://<this-computer's-LAN-IP>:3000`; allow Docker through the private-network firewall if prompted.
4. Choose **Parking** or **Backstage** from the top menu.

Use `docker compose logs -f` to view server logs and `docker compose down` to stop the app. Visitor counts are stored in the `visitor-data` Docker volume and remain when the container is rebuilt or stopped. To remove the app and its saved counts, run `docker compose down --volumes`.

## Run with Node.js

Install Node.js 18 or newer, then run `npm start` in this folder. Open the network address printed by the server on each device. Keep devices on the same Wi-Fi network and allow Node.js through the computer's private-network firewall if prompted.

Without Docker, visitor counts are stored in `data.json` beside the server. The app is designed for use on a trusted local network; it does not include sign-in or internet hosting.

## Backstage metrics

- **Current load** is the number of arrivals in the selected graph interval.
- **Last timeframe** shows the selected interval as hours and minutes.
- **Last update** shows elapsed time since the most recent count change.
- **Expected amount** projects the current arrival pace across the full selected interval.
