import { BlinkitSidebar } from "@/components/BlinkitSidebar";
import { CampaignForm } from "@/components/CampaignForm";

const Index = () => {
  return (
    <div className="flex min-h-screen w-full">
      <BlinkitSidebar />
      <CampaignForm />
    </div>
  );
};

export default Index;
