import React from 'react';
import {createRoot} from 'react-dom/client';
import {FolioRoot} from './FolioRoot';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><FolioRoot/></React.StrictMode>);
