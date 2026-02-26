import { Outlet } from 'react-router-dom';
import LNB from './LNB';

export default function HostLayout() {
    return (
        <div className="flex h-screen bg-gray-50">
            <LNB />
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
