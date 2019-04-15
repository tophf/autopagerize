A fork of [Autopagerize for Chrome](https://github.com/swdyh/autopagerize_for_chrome), fully reworked to reduce memory consumption and increase performance:

* the background page now auto-unloads when inactive
* the content script is added to a web page only if its URL has a matching rule
* when there are no more pages to load according to the paging rules, the content script unregisters all of its listeners and thus allows for garbage collector to purge the content script entirely (several megabytes per each tab)
* the URL matching (nearly 4000 of regexps!) is performed in a separate worker thread inside the background page so the extension is no longer blocked for long periods of time which could take up to half a second on a budget computer in the original extension
* IndexedDB is used to store the data objects directly without serializing as a string as the previously used localStorage had required
* Simple one-time messaging is used when needed instead of the persistent communication ports that were created for all the browser tabs
