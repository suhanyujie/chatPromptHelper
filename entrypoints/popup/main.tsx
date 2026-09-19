import ReactDOM from 'react-dom/client';
import { SettingsApp } from '../../components/SettingsApp';
import '../../assets/settings.css';

// 同一个组件，既作为工具栏 popup，也能在标签页里打开（面板上的齿轮走后一条路）
ReactDOM.createRoot(document.getElementById('root')!).render(<SettingsApp />);
