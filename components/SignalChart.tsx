import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { FrameFeature, RallyClip } from '../types';

interface SignalChartProps {
  data: FrameFeature[];
  rallies: RallyClip[];
  currentTime: number;
  onSeek: (time: number) => void;
}

const SignalChart: React.FC<SignalChartProps> = ({ data, rallies, currentTime, onSeek }) => {
  // Downsample for performance if data is huge
  const chartData = data.filter((_, i) => i % 5 === 0);

  return (
    <div className="h-48 w-full bg-slate-900/50 rounded-lg border border-slate-800 p-4 relative">
      <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex justify-between">
        <div className="flex items-center gap-4">
             <span>信号分析</span>
             <div className="flex items-center gap-2 text-[10px] font-normal lowercase">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>motion</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span>audio hit</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>held</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-700"></span>ground</span>
             </div>
        </div>
        <span className="text-emerald-500">检测到的回合: {rallies.length}</span>
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          onMouseDown={(e) => {
            if (e && e.activeLabel) onSeek(Number(e.activeLabel));
          }}
          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis 
            dataKey="t" 
            tick={{ fontSize: 10, fill: '#64748b' }} 
            interval={50}
            type="number"
            domain={['dataMin', 'dataMax']}
          />
          <YAxis hide domain={[0, 1.2]} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
            labelFormatter={(label) => `时间: ${Number(label).toFixed(1)}s`}
          />
          
          {/* Highlight Rallies */}
          {rallies.map((rally) => (
            <ReferenceArea 
              key={rally.id} 
              x1={rally.start} 
              x2={rally.end} 
              fill="#10b981" 
              fillOpacity={0.15} 
            />
          ))}

          <Area 
            type="monotone" 
            dataKey="motion_score" 
            stroke="#3b82f6" 
            fill="#3b82f6" 
            fillOpacity={0.1} 
            strokeWidth={1}
            isAnimationActive={false}
          />
          
          {/* Audio Hits Markers */}
          <Area 
            type="step" 
            dataKey={(d) => d.hit_audio ? 0.8 : 0} 
            stroke="transparent" 
            fill="#f43f5e" 
            fillOpacity={0.4} 
            isAnimationActive={false}
          />
          
          {/* Shuttle Held Signal (Top strip) */}
          <Area 
            type="step" 
            dataKey={(d) => d.shuttle_held ? 1.1 : 0} 
            stroke="transparent" 
            fill="#eab308" 
            fillOpacity={0.6} 
            baseValue={1.0} // Draw from 1.0 to 1.1
            isAnimationActive={false}
          />

          {/* Shuttle Ground Signal (Bottom strip) */}
          <Area 
            type="step" 
            dataKey={(d) => d.shuttle_ground ? 0.1 : 0} 
            stroke="transparent" 
            fill="#c2410c" 
            fillOpacity={0.8} 
            isAnimationActive={false}
          />

          {/* Current Time Indicator */}
          <ReferenceArea x1={currentTime} x2={currentTime + 0.5} fill="#ffffff" fillOpacity={0.8} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SignalChart;