Is there any way to have the link first prompt the user to install tapermonkey, allow userappscripts, then install the script?Thought processThought processUnfortunately no. Here's the limitation:

Tampermonkey installation — Users must manually install the extension from their browser's store (Chrome Web Store, Firefox Add-ons, etc.). You can't trigger that from a link.
Permissions — Browser handles those automatically once the extension is installed.
Script installation — Only after Tampermonkey exists can the .user.js link trigger the install prompt.

What you can do:
Add a README to your GitHub repo with clear installation steps:
## Installation

1. Install Tampermonkey for your browser:
   - Chrome: https://chrome.google.com/webstore/detail/tampermonkey/
   - Firefox: https://addons.mozilla.org/firefox/addon/tampermonkey/

2. Click here to install the script:
   https://raw.githubusercontent.com/TylerSedacca/OdooAllTasksCustomizer/refs/heads/main/script.user.js

3. Click "Install" in the Tampermonkey prompt
Then when someone finds your repo, they have clear steps & a direct link to install once Tampermonkey is ready.Okay so there isnt a way my github can host an installer that does this for the user automatically?Thought processThought processNo. Browsers don't allow any webpage (including GitHub) to programmatically install extensions — that's a security restriction. Only the browser's official extension store (Chrome Web Store, Firefox Add-ons, etc.) can do that, & only when the user clicks install there.
What you could do:
Create a landing page on GitHub that:

Checks if Tampermonkey is installed
If yes → Direct link to install the script
If no → Instructions to install Tampermonkey first, then the script

But the user still has to manually install Tampermonkey from their browser's store. You can't automate that part.
That's as close as you can get. The README approach is cleaner & simpler though.Add instructions to the readme on how to allow userscriptsThought processThought processThis readme is for Chrome onlyCreated a file, edited a fileCreated a file, edited a fileDone. Updated the README to Chrome-only with clear userscript permission steps. Copy this to your GitHub repo to replace the placeholder README.No file was sentRead a fileRead a fileThere's your README. Copy it to your GitHub repo (create a new file named README.md in the root).C:\Users\tyler\AppData\Roaming\Claude\local-agent-mode-sessions\824e0c03-5dfc-49a5-a40e-871fe668331f\2ce9bf47-5fe5-406b-a1dd-61066acbe32e\local_b06e0451-740d-4854-8c83-92b085481a70\outputs\README.mdDocument 
Claude is AI and can make mistakes. Please double-check responses. Give us feedbackReadme · MDOdoo All Tasks Customizer

A Tampermonkey userscript that enhances the Odoo All Tasks page with manual column resizing, automatic group expansion, & persistent custom group colors.

Features


Manual column widths — Drag column borders to resize; widths are saved automatically
Automatic group expansion — All task groups expand on page load
Custom group colors — Customize header & task row colors for each group; colors persist across sessions
Cell-level overrides — Automatically highlight CRITICAL & HIGH priority cells


Installation

1. Install Tampermonkey


Go to Chrome Web Store - Tampermonkey
Click "Add to Chrome"
Click "Add extension" in the popup


2. Allow Userscripts

Chrome requires you to allow Tampermonkey to access the Odoo domain:


Go to your Odoo all-tasks page
Click the Tampermonkey icon in the top-right toolbar
Click the gear icon (settings)
Go to "Whitelist/Blacklist" tab
Make sure your Odoo domain is whitelisted (or leave "Whitelist" empty to allow all sites)
Close settings & refresh the page


3. Install This Script

Click here to install:
Install Odoo All Tasks Customizer

Or manually:


Open Tampermonkey dashboard (click the extension icon → "Dashboard")
Click "+ Create a new script"
Paste this URL into the script:


javascript   // @require https://raw.githubusercontent.com/TylerSedacca/OdooAllTasksCustomizer/refs/heads/main/script.user.js


Save (Ctrl+S or Cmd+S)


Usage


Resize columns — Drag the right edge of any column header
Customize group colors — Click "Group Colors" button in the toolbar
Reset widths — Click "Reset Widths" button to restore default column sizes


Updates

The script auto-updates whenever changes are pushed to this repo. Tampermonkey checks for updates automatically.

Support

For issues or suggestions, open an issue on this GitHub repo.
