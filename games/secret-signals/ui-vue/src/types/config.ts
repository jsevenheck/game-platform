export interface HubIntegrationProps {
  playerId?: string;
  playerName?: string;
  sessionId?: string;
  joinToken?: string;
  wsNamespace?: string;
  apiBaseUrl?: string;
  isHost?: boolean;
}

export type GameComponentProps = HubIntegrationProps;
