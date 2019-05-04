A fork of [Autopagerize for Chrome](https://github.com/swdyh/autopagerize_for_chrome), fully reworked to reduce memory consumption and increase performance:

* the background page now auto-unloads when inactive
* the content script is added to a web page only if its URL has a matching rule
* the content script unregisters all of its listeners when there are no more pages to load according to the paging rules - and thus it gets removed by the garbage collector (several megabytes per each tab)
* when disabling the extension via the On/Off command all content scripts are fully unloaded 
* the URL matching regexps are cached upon each run of the background page so subsequent checks during the run are almost 100 times faster and take just a few milliseconds (the background page unloads after approximately five seconds of no navigation activity)
* IndexedDB is used to store the data objects directly whereas the previously used localStorage serialized them into a string 
* Simple one-time messaging and in-place code execution is used when needed instead of the persistent communication ports that were created for all the browser tabs

<img align="right" src="https://i.imgur.com/6wWETeo.png">Differences to the original:

* Exclusions are matched to the full URL now unless there's a `*` at the end. The original extension has been incorrectly treating all non-regexp URLs as prefixes.
  * `http://foo.com/bar` - this exact URL
  * `http://foo.com/bar*` - URLs that start with `http://foo.com/bar`
  * `*.foo.com/bar` - URLs that end in `foo.com/bar`
  * `*://*.foo.com/bar*` - URLs that contain `foo.com/bar` anywhere

New features:

* Configurable hotkeys chrome://extensions/shortcuts:
  * On/Off switch
  * Show the popup
  * Load 1,2,5,10 more pages - four separate commands
* On/Off command in the context menu of the extension icon in the browser toolbar

![popup](https://i.imgur.com/8tqVUxs.png) ![popup-dark](https://i.imgur.com/aV2cyw8.png)

New features in popup:

* Load 1-100 more pages
* Exclude current page URL/prefix/domain

New features in options:

* Custom rules in options
* Import/export of settings
* Customizable page request interval
* Dark theme

![options-dark](https://i.imgur.com/tHkuMmM.png)
