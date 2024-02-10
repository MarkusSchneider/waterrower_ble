git fetch --all
git reset --hard origin/main
sudo chmod +x ./setup.sh
sudo chmod +x ./update.sh

npm install
npm run build