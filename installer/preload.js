import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('setupApi', {
  getPaths: () => ipcRenderer.invoke('paths:get'),
  openChromeExtensions: () => ipcRenderer.invoke('chrome:openExtensions'),
  showExtensionFolder: () => ipcRenderer.invoke('folder:showExtension'),
  saveExtensionZip: () => ipcRenderer.invoke('zip:saveExtension'),
  convertWebm: () => ipcRenderer.invoke('converter:pickWebm')
});
