import { TicketsGraphCVA } from 'components/dashboard/TicketsGraphCVA';
import { DashboardData } from 'hooks/useCvaDashboard';

interface TicketsGraphSectionProps {
  timeframe: string;
  data: DashboardData | null;
  loading: boolean;
}

const TicketsGraphSection = ({ timeframe, data, loading }: TicketsGraphSectionProps) => {

  return (
    <TicketsGraphCVA timeFilter={timeframe} ticketingFunnel={data?.ticketing_funnel} isDataLoading={loading} />
  );
};

export default TicketsGraphSection;
