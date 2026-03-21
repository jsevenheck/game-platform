export interface HubIntegrationProps {
  playerId?: string;
  playerName?: string;
  sessionId?: string;
  joinToken?: string;
  wsNamespace?: string;
  apiBaseUrl?: string;
}

export type GameComponentProps = HubIntegrationProps;
