import {copy} from './content.js';
// Independent of Three.js: a saved English preference also applies when the engine fails to load.
let language='zh';try{if(localStorage.getItem('museum-language')==='en')language='en';}catch{}
const loading=document.getElementById('loading');
const api={language,error(key){document.getElementById('loadingTitle').textContent=copy[this.language].failed;document.getElementById('loadingStatus').textContent=copy[this.language][key]||copy[this.language].startupError;}};
window.museumLoading=api;
if(loading.style.display!=='none'){
 document.getElementById('loadingTitle').textContent=copy[language].loading;
 if(window.museumLoadErrorKey)api.error(window.museumLoadErrorKey);
}
