-- Reparo: transacoes abandonadas (ex.: save interrompido no meio) ficam 'idle in transaction'
-- segurando locks pra sempre no pooler. Mata elas e previne recorrencia com timeout.
select pg_terminate_backend(pid)
from pg_stat_activity
where state = 'idle in transaction' and pid <> pg_backend_pid();

alter role postgres set idle_in_transaction_session_timeout = '60s';
