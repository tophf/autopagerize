A fork of [Autopagerize for Chrome](https://github.com/swdyh/autopagerize_for_chrome), fully reworked to reduce memory consumption and increase performance:

* the background page now auto-unloads when inactive
* the content script is added to a web page only if its URL has a matching rule
* the content script unregisters all of its listeners when there are no more pages to load according to the paging rules - and thus it gets removed by the garbage collector (several megabytes per each tab)
* the URL matching regexps are cached upon each run of the background page so subsequent checks during the run are almost 100 times faster and take just a few milliseconds (the background page unloads after approximately five seconds of no navigation activity)
* IndexedDB is used to store the data objects directly whereas the previously used localStorage serialized them into a string 
* Simple one-time messaging and in-place code execution is used when needed instead of the persistent communication ports that were created for all the browser tabs
