export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ciclos: {
        Row: {
          created_at: string
          fim: string
          id: string
          inicio: string
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          fim: string
          id?: string
          inicio: string
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          fim?: string
          id?: string
          inicio?: string
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      compras_historico: {
        Row: {
          ciclo_id: string | null
          created_at: string
          created_by: string | null
          data: string
          fornecedor_id: string | null
          id: string
          item_id: string
          preco_unitario: number
          quantidade: number
        }
        Insert: {
          ciclo_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          fornecedor_id?: string | null
          id?: string
          item_id: string
          preco_unitario?: number
          quantidade?: number
        }
        Update: {
          ciclo_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          fornecedor_id?: string | null
          id?: string
          item_id?: string
          preco_unitario?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_historico_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_historico_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_historico_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          dia_virada: number
          frequencia_ciclo: string
          id: number
          updated_at: string
        }
        Insert: {
          dia_virada?: number
          frequencia_ciclo?: string
          id?: number
          updated_at?: string
        }
        Update: {
          dia_virada?: number
          frequencia_ciclo?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      contagens: {
        Row: {
          area: string
          ciclo_id: string
          contador_nome: string | null
          fardos: number
          id: string
          item_id: string
          tipo: string
          unidades: number
          updated_at: string
        }
        Insert: {
          area: string
          ciclo_id: string
          contador_nome?: string | null
          fardos?: number
          id?: string
          item_id: string
          tipo: string
          unidades?: number
          updated_at?: string
        }
        Update: {
          area?: string
          ciclo_id?: string
          contador_nome?: string | null
          fardos?: number
          id?: string
          item_id?: string
          tipo?: string
          unidades?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contagens_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          created_at: string
          estoque_minimo: number
          id: string
          nome: string
          preco_unidade: number
          supplier_id: string | null
          unidade_id: string
          unidades_por_fardo: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          estoque_minimo?: number
          id?: string
          nome: string
          preco_unidade?: number
          supplier_id?: string | null
          unidade_id: string
          unidades_por_fardo?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          estoque_minimo?: number
          id?: string
          nome?: string
          preco_unidade?: number
          supplier_id?: string | null
          unidade_id?: string
          unidades_por_fardo?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades_medida"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_compras: {
        Row: {
          ciclo_id: string | null
          created_at: string
          created_by: string | null
          id: string
          titulo: string | null
        }
        Insert: {
          ciclo_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          titulo?: string | null
        }
        Update: {
          ciclo_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listas_compras_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_compras_itens: {
        Row: {
          fornecedor_id: string | null
          id: string
          item_id: string
          lista_id: string
          observacao: string | null
          ordem: number
          preco_estimado: number
          quantidade: number
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          fornecedor_id?: string | null
          id?: string
          item_id: string
          lista_id: string
          observacao?: string | null
          ordem?: number
          preco_estimado?: number
          quantidade?: number
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          fornecedor_id?: string | null
          id?: string
          item_id?: string
          lista_id?: string
          observacao?: string | null
          ordem?: number
          preco_estimado?: number
          quantidade?: number
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_compras_itens_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listas_compras_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listas_compras_itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas_compras"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      unidades_medida: {
        Row: {
          abreviacao: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          abreviacao: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          abreviacao?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ciclo_atual: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      preco_estimado: { Args: { _item_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
