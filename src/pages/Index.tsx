import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { AudioInput } from '@/components/AudioInput';
import { AnalysisResult } from '@/components/AnalysisResult';
import { AnalysisHistory } from '@/components/AnalysisHistory';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisResult as AnalysisResultType } from '@/types/analysis';

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'transcribing' | 'analyzing'>('transcribing');
  const [currentResult, setCurrentResult] = useState<AnalysisResultType | null>(null);
  const [history, setHistory] = useState<AnalysisResultType[]>([]);
  const { toast } = useToast();

  const handleAudioSubmit = useCallback(async (audioBlob: Blob, fileName: string) => {
    setIsProcessing(true);
    setProcessingStage('transcribing');
    setCurrentResult(null);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      // Call analysis edge function
      setProcessingStage('analyzing');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            audio: audioBase64,
            fileName,
            mimeType: audioBlob.type,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      
      const result: AnalysisResultType = {
        id: crypto.randomUUID(),
        originalText: data.originalText || '',
        detectedLanguage: data.detectedLanguage || 'Unknown',
        englishTranslation: data.englishTranslation || '',
        riskLevel: data.riskLevel || 'low',
        confidenceScore: data.confidenceScore || 0,
        analysisDetails: data.analysisDetails || '',
        timestamp: new Date(),
        audioFileName: fileName,
      };

      setCurrentResult(result);
      setHistory((prev) => [result, ...prev]);

      if (result.riskLevel === 'high') {
        toast({
          title: '⚠️ High Risk Detected',
          description: 'Potentially threatening content identified. Human review required.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'An error occurred during analysis',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleHistorySelect = useCallback((result: AnalysisResultType) => {
    setCurrentResult(result);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AudioInput 
              onAudioSubmit={handleAudioSubmit} 
              isProcessing={isProcessing} 
            />
            
            {isProcessing && (
              <ProcessingOverlay stage={processingStage} />
            )}
            
            {currentResult && !isProcessing && (
              <AnalysisResult result={currentResult} />
            )}
            
            {!currentResult && !isProcessing && (
              <div className="glass-panel rounded-xl p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Ready for Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload an audio file or record live audio to begin multilingual threat intent detection.
                    Supports Kashmiri and other languages.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <AnalysisHistory 
              history={history} 
              selectedId={currentResult?.id}
              onSelect={handleHistorySelect}
            />
            
            {/* Disclaimer */}
            <div className="glass-panel rounded-xl p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">Important Disclaimer</p>
              <p>
                This system is designed for <strong>research and academic purposes only</strong>. 
                No automated enforcement or real-world action is taken.
              </p>
              <p>
                <strong>Human review is mandatory</strong> before any decision based on analysis results.
                The system follows ethical AI principles.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
