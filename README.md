# Server Application
This project is the backend from the Mobility Choices Project. The server is written in NodeJS and the communication
with the client (App) is over the REST-API.

# Requirements
- Node v10.15.3
- MongoDB

# Installation
1. Create a nodeJS project
2. Clone the repository into the nodeJS project
```
git clone https://github.com/MobilityChoicesProject/mobility_choices_backend.git .
```
3. Go into the project folder `<ProjectFolder>/MobilityChoices` and run the command `npm install`
4. Install PM2 globally `npm install pm2 -g` (http://pm2.keymetrics.io/)
5. If you have not installed MongoDB already, install the Database (https://www.mongodb.com/)
6. Configure your datasources configuration in the file `<ProjectFolder>/MobilityChoices/server/datasources.json`.
7. Copy your certificates into `<ProjectFolder>/MobilityChoices/certificate`. You need at least a private key and ssl certificate.
8. Insert your API-Keys in the file `<ProjectFolder>/MobilityChoices/server/keys.json`
9. In the config file `<ProjectFolder>/MobilityChoices/server/config.json` type in the path to your certificate key and cert file. Alternatively, the `"httpMode"` configuration can be set to `true`. Then no certificates are needed.
For example: 
```
"httpMode": false,
"certConfig": {
    "key": "pk_Wildcard.pem",
    "cert": "STAR_mobility-choices_org.pem",
    "ca": [],
    "requestCert": false,
    "rejectUnauthorized": false
  }
```
10. Configure the addresses to the TMD-Server and the E-Mail Adress in the `<ProjectFolder>/MobilityChoices/server/custom/constants.js` file.
11. Now you can start the server, open a terminal and go into
the directory `<ProjectFolder>/MobilityChoices/server` and run the command `pm2 start server.js`.

# REST API
As already mentioned, the client-server communication is over a REST API.
The API is built with the loopback framework (https://loopback.io/)

If the server is running you can open the following link in your browser to see the available API.
`https://<server_url>:3000/explorer/`
