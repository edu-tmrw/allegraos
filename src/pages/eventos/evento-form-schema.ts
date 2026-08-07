import { z } from "zod";

export const eventoSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do evento.").max(80, "Máximo de 80 caracteres."),
  eventTypeId: z.string().min(1, "Selecione o tipo de evento."),
  eventDate: z.string().min(1, "Selecione a data do evento."),
  eventTime: z.string(),
});

export type EventoFormValues = z.infer<typeof eventoSchema>;
