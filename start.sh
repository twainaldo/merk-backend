#!/bin/bash

# Charger NVM et utiliser Node v20
source ~/.nvm/nvm.sh
nvm use default

# Lancer le serveur
npm run dev
