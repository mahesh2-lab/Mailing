export interface NewEmailPayload {
  emailId?: string;
  from?: string;
  to?: string | string[];
  subject?: string;
  preview?: string;
}

export interface DeliveryStatusPayload {
  emailId?: string;
  to?: string | string[];
  subject?: string;
}

export interface NotificationPayload {
  title?: string;
  message?: string;
  description?: string;
}

export interface ToastPayload {
  type?: "success" | "error" | "info" | "warning";
  message?: string;
  description?: string;
}

export interface PusherConnectionError {
  type?: string;
  error?: {
    data?: {
      code?: number;
      message?: string;
    };
  };
  data?: {
    code?: number;
    message?: string;
  };
  message?: string;
}
