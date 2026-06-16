import { Box } from '@radix-ui/themes';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';
import { Text } from '@radix-ui/themes';

const conversationSourceData = [
  { name: 'MS Teams App', value: 45, color: '#8979FF' },
  { name: 'Chrome', value: 35, color: '#B79FFF' },
  { name: 'Safari', value: 15, color: '#4A1FB8' },
  { name: 'Other', value: 5, color: '#FFB84C' }
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

const CustomLegend = ({ payload = [] }: LegendProps) => {
  return (
    <div className="flex justify-center gap-6 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.payload.color }}
          />
          <span className="text-sm text-gray-600">
            {entry.payload.name}
          </span>
        </div>
      ))}
    </div>
  );
};

const ConversationSourceDonut = () => {
  return (
    <Box className="bg-white p-6 rounded-xl border border-[#E5E7EB]" style={{ width: '370px' }}>

      <Text size="5" weight="medium" mb="4">
        Conversation Source
      </Text>
      <Box className="h-[300px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={conversationSourceData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {conversationSourceData.map((entry, index) => (
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

export default ConversationSourceDonut;
