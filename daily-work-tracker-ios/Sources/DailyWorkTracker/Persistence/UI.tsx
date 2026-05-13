import React from 'react';

export const Card: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
  <div className={`bg-white shadow rounded-lg overflow-hidden ${className}`}>
    <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
      <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
    </div>
    <div className="px-4 py-5 sm:p-6">{children}</div>
  </div>
);

export const Button: React.FC<{ 
  onClick?: () => void; 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'ghost'; 
  className?: string 
}> = ({ onClick, children, variant = 'primary', className = "" }) => {
  const baseStyles = "inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    secondary: "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500",
    ghost: "border-transparent text-indigo-600 bg-transparent hover:bg-indigo-50 shadow-none"
  };
  
  return (
    <button onClick={onClick} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
  />
);

export const Table: React.FC<{ 
  data: any[]; 
  columns: { title: string; dataIndex?: string; render?: (row: any) => React.ReactNode }[] 
}> = ({ data, columns }) => (
  <div className="flex flex-col">
    <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
        <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, i) => (
                <tr key={i}>
                  {columns.map((col, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {col.render ? col.render(row) : row[col.dataIndex!]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

// Simple Mock of RangePicker for the enterprise workflow
export const DatePicker = {
  RangePicker: ({ onChange }: { onChange: (dates: [string, string]) => void }) => {
    const [start, setStart] = React.useState("");
    const [end, setEnd] = React.useState("");

    React.useEffect(() => {
      if (start && end) onChange([start, end]);
    }, [start, end]);

    return (
      <div className="flex space-x-2">
        <Input 
          type="date" 
          value={start} 
          onChange={(e) => setStart(e.target.value)} 
          className="w-full"
        />
        <span className="text-gray-500 self-center">to</span>
        <Input 
          type="date" 
          value={end} 
          onChange={(e) => setEnd(e.target.value)} 
          className="w-full"
        />
      </div>
    );
  }
};