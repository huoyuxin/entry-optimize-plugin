const WatchPack = require('watchpack');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const MultiEntryPlugin = require('webpack/lib/MultiEntryPlugin');
class EntryOptimizePlugin {
  constructor(options) {
    this.options = options;
    this.originEntries = null;
  }
  apply(compiler) {
    compiler.plugin('entry-option', function(context, entry) {
      this.originEntries = cloneObject(entry);
      this.rebaseEntries = cloneObject(entry);
      this.originContext = context;
    })
    compiler.plugin('compile', function(params) {
      let stayEntry = [];
      if (!this.fileEntryMap || !this.notFirstIn || !this.filesModified) return;
      if (this.fileEntryMap.has(this.filesModified)) {
        stayEntry = stayEntry.concat(this.fileEntryMap.get(this.filesModified));
      }
      if (!stayEntry.length) return;
      Object.keys(this.originEntries).forEach(el => {
        stayEntry.indexOf(el) === -1 && delete this.originEntries[el];
      })
      delete this._plugins['make'];
      Object.keys(this.originEntries).forEach(name => compiler.apply(itemToPlugin(this.originContext, this.originEntries[name], name)));
      this.originEntries = cloneObject(this.rebaseEntries);
    })
    compiler.plugin('done', function(stats) {
      if (!this.notFirstIn) {
        this.notFirstIn = true;
        this.originFileDependencies = stats.compilation.fileDependencies;
        var fileEntryMap = new Map();
        buildMap(stats.compilation.modules, fileEntryMap);
        this.fileEntryMap = fileEntryMap;
      }
      stats.compilation.fileDependencies.forEach(file => {
        this.originFileDependencies.indexOf(file) === -1 && this.originFileDependencies.push(file);
      })
      stats.compilation.fileDependencies = this.originFileDependencies;
      this.originFileDependencies = stats.compilation.fileDependencies;
    })
    compiler.plugin('done', function(stats) {
      var files = stats.compilation.fileDependencies;
      var dirs = stats.compilation.contextDependencies;
      var startTime = stats.compilation.startTime;
      var oldWatch = stats.compilation.compiler.entryOptimizeWather;
      stats.compilation.compiler.entryOptimizeWather = new WatchPack();
      stats.compilation.compiler.entryOptimizeWather.once('change', function(file) {
        stats.compilation.compiler.filesModified = file;
      })
      stats.compilation.compiler.entryOptimizeWather.watch(files, dirs, startTime);
      if (oldWatch) {
        oldWatch.close();
      }
    })
  }
};
function buildMap(modules, fileEntryMap) {
  modules.forEach(module => {
    if (module.resource) {
      !fileEntryMap.has(module.resource) && fileEntryMap.set(module.resource, []);
      module.chunks.forEach(chunk => {
        fileEntryMap.get(module.resource).indexOf(chunk.name) === -1 && fileEntryMap.get(module.resource).push(chunk.name);
      })
    }
  })
}
function itemToPlugin(context, item, name) {
  if (Array.isArray(item)) {
    return new MultiEntryPlugin(context, item, name);
  }
  return new SingleEntryPlugin(context, item, name);
}
function cloneObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => cloneObject(item));
  } else if (obj === null) {
    return null;
  } else if (typeof obj === 'object') {
    const result = {};
    Object.keys(obj).forEach(key => {
      result[key] = cloneObject(obj[key]);
    });
    return result;
  }
  return obj;
}
module.exports = EntryOptimizePlugin;