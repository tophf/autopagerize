### A fork of [Autopagerize for Chrome](https://github.com/swdyh/autopagerize_for_chrome)
 
<img align="right" src="https://i.imgur.com/6wWETeo.png">

Fully reworked to reduce memory consumption and increase performance:

* the background page now auto-unloads when inactive
* the content script is added to a web page only if its URL has a matching rule
* the content script unregisters all of its listeners when there are no more pages to load according to the paging rules - and thus it gets removed by the garbage collector (several megabytes per each tab)
* when disabling the extension via the On/Off command all content scripts are fully unloaded 
* the URL matching regexps are cached upon each run of the background page so subsequent checks during the run are almost 100 times faster and take just a few milliseconds (the background page unloads after approximately five seconds of no navigation activity)
* IndexedDB is used to store the data objects directly whereas the previously used localStorage serialized them into a string 
* Simple one-time messaging and in-place code execution is used when needed instead of the persistent communication ports that were created for all the browser tabs

### Differences to the original:

* Generic rules are disabled by default and can be re-enabled per site/pattern (a `*` pattern that matches all sites may be used to restore the old behavior) in the options or the popup. This is because these rules (currently there are three) seem to be useless as the popular sites all have a custom rule, while breaking the page layout on less popular sites a bit too often.
* Exclusions are matched to the full URL now unless there's a `*` at the end. The original extension has been incorrectly treating all non-regexp URLs as prefixes.
  * `http://foo.com/bar` - this exact URL
  * `http://foo.com/bar*` - URLs that start with `http://foo.com/bar`
  * `*.foo.com/bar` - URLs that end in `foo.com/bar`
  * `*://*.foo.com/bar*` - URLs that contain `foo.com/bar` anywhere

### New features:

* Configurable hotkeys chrome://extensions/shortcuts:
  * On/Off switch
  * Show the popup
  * Load 1,2,5,10 more pages - four separate commands
* On/Off command in the context menu of the extension icon in the browser toolbar

![popup](https://i.imgur.com/8tqVUxs.png) ![popup-dark](https://i.imgur.com/aV2cyw8.png)

### New features in popup:

* Load 1-100 more pages
* Exclude current page URL/prefix/domain
* Enable generic rules for current page URL/prefix/domain

### New options:

* Custom rules
* Ability to start the database update manually
* Customizable internal parameters 
* Import/export

![options-dark](https://i.imgur.com/4GNQkYw.png)

### Permissions:

* `wedata.net` - used to update the database of pagination rules from http://wedata.net/databases/AutoPagerize/items_all.json which is stripped of everything except XPath selectors for the page elements and RegExp for the page URL
* `<all_urls>` - required to paginate while you browse according to the database of rules (technically, to find the "next page" and "page body" elements)
* `webNavigation` - to schedule a pagination check when you navigate to a new URL
* `contextMenus` - to add an "On/off" item to the context menu of the extension icon in the browser toolbar 
* `storage` - to store the options of the extension
* `tabs` - most notably to restart the paging functionality on extension update, also to notify the tabs that match the URL that you've just manually excluded in the popup  

### How to limit the site permissions 

Chrome allows you to easily limit the extension so it can access only a few sites:

1. right-click the extension icon in the toolbar (or browser menu) and click "Manage" - it'll open `chrome://extensions` details page for this extension 
2. click "On specific sites"
3. enter the URL you want to allow
4. to add more sites click "Add a new page"
5. add `http://wedata.net` to keep the database of rules up-to-date. 

![limit UI](https://i.imgur.com/F2nqVdL.png)
