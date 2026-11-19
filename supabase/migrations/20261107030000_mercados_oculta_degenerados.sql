-- Odds <= 1.00 sao degeneradas (sempre vence e nao paga nada). Esconde em vez de apagar: preserva eventuais apostas.
update mercados set oculto = true where multiplicador <= 1;
