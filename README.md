> [!CAUTION]
> NEITHER ME NOR VENCORD IS RESPONSIBLE FOR DAMAGE PLUGINS YOU INSTALL CAUSE.
> ALWAYS CHECK TO MAKE SURE PLUGINS YOU INSTALL ARE SAFE AND TRUSTED.
> UNOFFICIAL PLUGINS HAVE CONTROL OVER YOUR COMPUTER AND CAN DO SERIOUS DAMAGE IF NOT CAREFUL.
> UPDATING PLUGINS CAN ALSO INTRODUCE UNSAFE OR UNTRUSTED CODE.
> THIS PLUGIN IS NOT AFFILIATED WITH VENCORD AND YOU SHOULD NOT BE ASKING FOR SUPPORT FOR THIS PLUGIN IN THE VENCORD DISCORD SERVER.

> [!WARNING]
> This plugin is still in its early versions. Some stuff probably does not work correctly yet. Linux and MacOS compatibility is also not guranteed yet.

# UnofficialPluginInstaller

This is an _Unofficial_ Vencord Plugin that adds an interface to install and manage other unofficial plugins.

![image](https://github.com/user-attachments/assets/df4ae48e-62ed-4f38-98a3-944514a09d97)

## Features

- Interface to manage unofficial plugins
- Installs unofficial plugins from GitHub links or directories
- Checks for updates for plugins installed from a Repository

## Install

> [!NOTE]
> You are expected to have some amount of technical knowledge. We do not provide support for installing the plugin into Vencord, if you cannot figure this out the plugin is not for you.

> [!CAUTION]
> Linux installs over flatpak are not supported due to the sandbox messing with how the plugin works. If you can figure out how to run it, great! We will not support it though.

### Requirements

- Git
- pnpm

### Installation

- Create an empty working directory
- Clone the official Vencord repository
- Create a new folder inside of src called userplugins
- Clone this repository into userplugins
- Run `pnpm i --frozen-lockfile`
- Run `pnpm run build`
- Run `pnpm run inject` and complete the injection process

## Usage

After installing the plugin and checking if its enabled inside of Vencords official Plugin menu (you potentially have to restart your Discord if it wasn't enabled), a new category at the bottom of the Vencord category inside the user settings should appear.
Opening "Unofficial Plugins" prompts you with a modal confirming your acknowledgement installing unofficial plugins may cause. This will only happen the first time the plugin is installed.

You will now be prompted to initialise the plugin.
This causes the plugin to clone a new copy of the Vencord repository to your user profile folder (home directory on linux/macos, appdata on windows and specifically under the Vencord directory there).
If anything goes wrong you will be shown an error modal, additional information should be printed to the Discord console.

If the initialisation process is successful, you will be greeted with the Unofficial Plugin Installer UI.

To install a plugin you simply enter the GitHub repository link into the text box and press install.
You can also copy existing plugin directories using the install from directory action.
There will now be a new plugin card with your plugin.
To properly integrate the plugin into Vencord you must now press the "Build & Inject" button.
Here you will be prompted to select your Discord branch and after confirming should automatically build, then inject and close your Discord.

Simply re-open your Discord now and the plugin should be fully loaded inside of the Unofficial Plugin menu. You can now enable it inside of Vencords official plugin menu.

Plugin updates are checked each time you open the Unofficial Plugin menu. If a plugin does have a new update you can update it using the green button next to the delete icon. You can also immediately update all plugins using the Update All button (note that this button only becomes available if any plugin actually needs an update).
After downloading the update you must Build & Inject again.

## Contributing

Any and all contributions are welcome, from bug reports to merge requests. There are no real contribution requirements except for don't try to merge garbage code I guess.
