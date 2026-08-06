"""
Rate limiting simples em memória, para travar força bruta no login.

Limitações conhecidas (aceitáveis hoje, mas registradas):

- O estado é por processo. Em produção o uvicorn roda com `--workers 2`, então
  o limite efetivo é o dobro do configurado (as tentativas caem em workers
  diferentes). Para um limite exato seria preciso um store compartilhado
  (Redis), o que não se justifica na escala atual.
- O uvicorn não roda com `--proxy-headers`, então `request.client.host` é o IP
  do nginx, igual para todo mundo. Por isso a chave inclui o e-mail: mesmo com
  o IP colapsado, atacar uma conta específica continua sendo limitado — que é
  o caso que importa.

ESPELHO de app_dev/backend/app/shared/rate_limit.py.
Cópia literal — se mexer lá, mexa aqui. O site de atendimento é um app separado
de propósito (isolamento de dados), e o preço disso é manter estes poucos
arquivos em sincronia.
"""
import time
from collections import defaultdict
from threading import Lock
from typing import Dict, List


class TentativasPorChave:
    """Conta tentativas numa janela deslizante e bloqueia quando estoura."""

    def __init__(self, max_tentativas: int, janela_segundos: int, bloqueio_segundos: int):
        self.max_tentativas = max_tentativas
        self.janela_segundos = janela_segundos
        self.bloqueio_segundos = bloqueio_segundos
        self._tentativas: Dict[str, List[float]] = defaultdict(list)
        self._bloqueados: Dict[str, float] = {}
        self._lock = Lock()

    def segundos_de_bloqueio(self, chave: str) -> int:
        """0 se liberado; senão, quantos segundos ainda faltam."""
        agora = time.time()
        with self._lock:
            ate = self._bloqueados.get(chave)
            if ate is None:
                return 0
            if agora >= ate:
                del self._bloqueados[chave]
                self._tentativas.pop(chave, None)
                return 0
            return int(ate - agora) + 1

    def registrar_falha(self, chave: str) -> None:
        agora = time.time()
        with self._lock:
            recentes = [t for t in self._tentativas[chave] if agora - t < self.janela_segundos]
            recentes.append(agora)
            self._tentativas[chave] = recentes
            if len(recentes) >= self.max_tentativas:
                self._bloqueados[chave] = agora + self.bloqueio_segundos
                self._tentativas[chave] = []

    def registrar_sucesso(self, chave: str) -> None:
        with self._lock:
            self._tentativas.pop(chave, None)
            self._bloqueados.pop(chave, None)


# 5 tentativas erradas em 5 min → 15 min de bloqueio.
login_limiter = TentativasPorChave(
    max_tentativas=5,
    janela_segundos=5 * 60,
    bloqueio_segundos=15 * 60,
)
