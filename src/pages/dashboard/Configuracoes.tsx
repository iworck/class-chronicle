import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, MessageSquare, Mail } from 'lucide-react';
import WhatsApp from './WhatsApp';
import EmailConfig from './EmailConfig';

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('whatsapp');

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie integrações de WhatsApp, Email e outras configurações do sistema.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageSquare className="w-4 h-4" />WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="w-4 h-4" />Email (SMTP)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <WhatsApp />
        </TabsContent>

        <TabsContent value="email">
          <EmailConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
