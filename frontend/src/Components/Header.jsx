import React from 'react';
import { ShoppingCart } from 'lucide-react';

const Header = ({ isReadOnly, id, title = "Order Entry Portal" }) => (
  <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between sticky top-0 z-[100] shadow-sm flex-shrink-0">
    <div className="flex items-center gap-2">
      <div className="p-1.5 bg-blue-600 rounded shadow-sm">
        <ShoppingCart className="w-4 h-4 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">
            {id ? `Edit ${title}` : `New ${title}`}
          </h1>
          {isReadOnly && (
            <div className="flex items-center gap-1 px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[8px] font-black uppercase tracking-wider">Locked</span>
            </div>
          )}
        </div>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
          {isReadOnly ? "Transaction Completed" : "Order Entry Portal"}
        </p>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <div className="h-6 w-px bg-slate-200 mx-1"></div>
      <div className="flex flex-col items-end">
        <span className="text-[8px] font-black text-blue-500 uppercase leading-none">Powered By</span>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">LensBackup</span>
      </div>
    </div>
  </div>
);

export default Header;
