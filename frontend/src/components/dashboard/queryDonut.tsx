import { Box, Flex } from '@radix-ui/themes';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Label } from 'recharts';
import { Text } from '@radix-ui/themes';
// Add this data near your other mock data
const queryTypeData = [
  { name: 'Incident', value: 33.33, color: '#8979FF' },
  { name: 'Service Request', value: 33.33, color: '#B79FFF' },
  { name: 'Info', value: 33.33, color: '#4A1FB8' }
];

interface LegendProps {
  payload?: {
    value: string;
    color: string;
    payload: {
      name: string;
      value: number;
      color: string;
    };
  }[];
}

// Make payload optional since it might be empty initially
const CustomLegend = ({ payload = [] }: LegendProps) => {
  return (
    <div className="flex justify-center gap-6 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-600">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Add this component
const QueryTypeDonut = () => {
  return (
    <Box className="bg-white p-6 rounded-xl border border-[#E5E7EB]" style={{ width: '375px' }}>
      <Text size="5" weight="medium" mb="4">
        Query Type
      </Text>
      <Box className="h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={queryTypeData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={120}
              paddingAngle={0}
              dataKey="value"
              labelLine={false}
              label={({
                cx,
                cy,
                midAngle,
                innerRadius,
                outerRadius,
                name,
                value
              }) => {
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

                return (
                  <text
                    x={x}
                    y={y}
                    fill="white"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="14"
                  >
                    <tspan x={x} dy="-0.5em">{name.split(' ').length > 1 ? name.split(' ')[0] : name}</tspan>
                    {name.split(' ').length > 1 && <tspan x={x} dy="1.2em">{name.split(' ')[1]}</tspan>}
                    <tspan x={x} dy="1.5em">{value}%</tspan>
                  </text>
                );
              }}
            >
              {queryTypeData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke="none"
                />
              ))}
            </Pie>
            <Legend 
              content={<CustomLegend />}
              verticalAlign="bottom"
              height={36}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};



export default QueryTypeDonut;