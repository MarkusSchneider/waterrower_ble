sudo apt update 
sudo apt upgrade -y
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev libusb-1.0-0-dev -y
sudo apt-get install libcap2-bin
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
sudo service bluetooth stop
sudo update-rc.d bluetooth remove

npm install
npm run build