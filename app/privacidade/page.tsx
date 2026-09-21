import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade | MirraCRM',
  description:
    'Conheça como o MirraCRM trata dados pessoais e como solicitar acesso, correção ou exclusão de informações.',
};

const contactEmail = 'contato@mirracrm.com.br';

export default function PrivacyPolicyPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d1422',
        color: '#e8eef8',
        fontFamily:
          'Arial, Helvetica, sans-serif',
        padding: '48px 20px',
      }}
    >
      <article
        style={{
          maxWidth: 860,
          margin: '0 auto',
          lineHeight: 1.8,
        }}
      >
        <header
          style={{
            borderBottom: '1px solid #334155',
            paddingBottom: 28,
            marginBottom: 36,
          }}
        >
          <a
            href="/"
            style={{
              color: '#38bdf8',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            MirraCRM
          </a>

          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 42px)',
              lineHeight: 1.2,
              marginTop: 24,
              marginBottom: 12,
            }}
          >
            Política de Privacidade
          </h1>

          <p style={{ color: '#94a3b8' }}>
            Última atualização: 18 de setembro de 2026
          </p>
        </header>

        <section>
          <h2>1. Apresentação</h2>

          <p>
            O MirraCRM é uma plataforma de gestão de
            relacionamento com clientes destinada a apoiar
            atividades comerciais, organização de leads,
            acompanhamento de oportunidades, gestão de
            equipes e comunicação com clientes.
          </p>

          <p>
            Esta Política de Privacidade explica quais
            categorias de dados pessoais podem ser tratadas
            por meio da plataforma, para quais finalidades
            são utilizadas e como os titulares podem
            solicitar informações ou exercer seus direitos.
          </p>

          <p>
            O tratamento de dados pessoais deve observar
            a Lei Geral de Proteção de Dados Pessoais
            (Lei nº 13.709/2018), conhecida como LGPD.
          </p>
        </section>

        <section>
          <h2>2. Responsável pelo MirraCRM</h2>

          <p>
            Responsável identificado pelo MirraCRM:
            <strong> José Carlos Vignola</strong>.
          </p>

          <p>
            Contato para assuntos relacionados à
            privacidade:
            {' '}
            <a href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>.
          </p>

          <p>
            As responsabilidades pelo tratamento dependem
            de cada operação. O MirraCRM pode atuar como
            controlador dos dados necessários à administração
            da própria plataforma e como operador dos dados
            inseridos por empresas e profissionais que
            utilizam o serviço, conforme as circunstâncias
            e as instruções aplicáveis.
          </p>
        </section>

        <section>
          <h2>3. Dados pessoais tratados</h2>

          <h3>3.1. Dados de usuários</h3>

          <p>
            Podem ser tratados nome, endereço de e-mail,
            identificadores de usuário, informações de
            autenticação, perfil de acesso e vínculo com
            a conta ou equipe.
          </p>

          <h3>3.2. Dados de leads e clientes</h3>

          <p>
            Conforme as informações cadastradas pelos
            usuários, podem ser tratados nome, empresa,
            telefone, celular, e-mail, informações
            comerciais, etapa do funil de vendas,
            classificações e histórico de relacionamento.
          </p>

          <h3>3.3. Dados de atendimento pelo WhatsApp</h3>

          <p>
            Quando a integração com o WhatsApp Business
            estiver habilitada, a plataforma poderá tratar
            números de telefone, nomes de contatos,
            conteúdo de mensagens, datas e horários,
            identificadores técnicos, informações de
            entrega e leitura, responsáveis pelo
            atendimento e mídias relacionadas às conversas.
          </p>

          <h3>3.4. Dados técnicos</h3>

          <p>
            Dados técnicos necessários à autenticação,
            segurança e funcionamento do serviço poderão
            ser tratados de acordo com os recursos
            efetivamente utilizados e os registros
            mantidos pelos prestadores de infraestrutura.
          </p>
        </section>

        <section>
          <h2>4. Finalidades do tratamento</h2>

          <p>
            Os dados pessoais são tratados, conforme
            a funcionalidade utilizada, para:
          </p>

          <ul>
            <li>
              Cadastrar, organizar e acompanhar leads
              e clientes.
            </li>

            <li>
              Gerenciar oportunidades e etapas do
              funil de vendas.
            </li>

            <li>
              Administrar usuários, equipes e
              permissões de acesso.
            </li>

            <li>
              Distribuir responsabilidades de atendimento.
            </li>

            <li>
              Viabilizar comunicações comerciais pelo
              WhatsApp Business, quando a integração
              estiver habilitada.
            </li>

            <li>
              Apresentar relatórios relacionados às
              atividades registradas no CRM.
            </li>

            <li>
              Manter o funcionamento, a autenticação
              e a segurança da plataforma.
            </li>

            <li>
              Cumprir obrigações legais e atender
              solicitações legítimas.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Bases legais</h2>

          <p>
            O tratamento de dados pessoais deve estar
            fundamentado em uma hipótese legal aplicável,
            conforme a natureza e a finalidade da operação.
          </p>

          <p>
            Dependendo das circunstâncias, poderão ser
            aplicáveis a execução de contrato, o
            cumprimento de obrigação legal ou regulatória,
            o legítimo interesse, quando cabível, ou
            o consentimento, quando necessário.
          </p>

          <p>
            As empresas e os profissionais que inserem
            dados de seus próprios contatos no MirraCRM
            são responsáveis por avaliar as bases legais
            adequadas às suas atividades e comunicações.
          </p>
        </section>

        <section>
          <h2>6. Integração com o WhatsApp Business</h2>

          <p>
            O MirraCRM possui funcionalidades destinadas
            à integração com o WhatsApp Business para
            gerenciamento de conversas e atendimentos
            comerciais.
          </p>

          <p>
            Quando a integração estiver efetivamente
            conectada, informações necessárias ao envio,
            recebimento e acompanhamento de mensagens
            poderão ser processadas por meio dos serviços
            da Meta.
          </p>

          <p>
            A disponibilidade dessas funcionalidades
            depende das condições técnicas da integração
            e das regras aplicáveis da Meta.
          </p>

          <p>
            Os usuários devem respeitar as regras
            aplicáveis à comunicação com contatos,
            incluindo os requisitos de autorização
            para envio de mensagens.
          </p>

          <p>
            O MirraCRM não solicita que usuários
            informem suas senhas pessoais do Facebook
            ou WhatsApp para armazená-las na plataforma.
          </p>
        </section>

        <section>
          <h2>7. Compartilhamento de dados</h2>

          <p>
            Dados pessoais poderão ser compartilhados
            quando necessário à prestação do serviço,
            observadas as finalidades aplicáveis e
            a legislação.
          </p>

          <p>
            As categorias de destinatários podem incluir
            prestadores de hospedagem, banco de dados,
            autenticação e infraestrutura, além da Meta
            quando a integração com o WhatsApp Business
            estiver habilitada.
          </p>

          <p>
            Dados também poderão ser disponibilizados
            a autoridades competentes quando houver
            obrigação legal ou solicitação juridicamente
            válida.
          </p>

          <p>
            Os fornecedores e as condições específicas
            de tratamento devem ser avaliados de acordo
            com os serviços efetivamente contratados.
          </p>
        </section>

        <section>
          <h2>8. Retenção e conservação</h2>

          <p>
            Os dados pessoais são conservados enquanto
            necessários às finalidades que justificam
            seu tratamento, considerando a relação
            contratual, as instruções dos clientes
            responsáveis e as obrigações legais aplicáveis.
          </p>

          <p>
            Informações comerciais, registros de leads,
            oportunidades e históricos de atendimento
            poderão ser mantidos enquanto necessários
            às atividades determinadas pelo respectivo
            cliente controlador.
          </p>

          <p>
            Solicitações de exclusão ou anonimização
            serão avaliadas considerando a natureza
            dos dados, a responsabilidade pelo tratamento
            e as hipóteses legais de conservação.
          </p>

          <p>
            A exclusão dos sistemas ativos e a expiração
            de eventuais cópias de segurança dependem
            dos procedimentos técnicos e dos ciclos
            efetivamente adotados pela infraestrutura
            utilizada.
          </p>

          <p>
            O MirraCRM não estabelece nesta política
            um prazo uniforme de eliminação para todas
            as categorias de dados. Prazos específicos
            deverão ser definidos e comunicados conforme
            a finalidade, a necessidade de conservação
            e os procedimentos efetivamente implementados.
          </p>
        </section>

        <section>
          <h2>9. Segurança das informações</h2>

          <p>
            O MirraCRM deve adotar medidas técnicas
            e administrativas adequadas à proteção
            dos dados pessoais, considerando os riscos
            associados às operações realizadas.
          </p>

          <p>
            Essas medidas abrangem, conforme sua
            implementação efetiva, autenticação,
            controles de acesso, proteção de credenciais
            e restrição do acesso a informações pessoais.
          </p>

          <p>
            Nenhum sistema tecnológico é completamente
            imune a riscos. Eventuais incidentes serão
            avaliados conforme a legislação e as
            obrigações aplicáveis.
          </p>
        </section>

        <section>
          <h2>10. Direitos dos titulares</h2>

          <p>
            Os titulares poderão exercer os direitos
            previstos na LGPD, observadas as condições
            legais aplicáveis, incluindo:
          </p>

          <ul>
            <li>
              Confirmação da existência de tratamento.
            </li>

            <li>
              Acesso aos dados pessoais.
            </li>

            <li>
              Correção de informações incompletas,
              inexatas ou desatualizadas.
            </li>

            <li>
              Anonimização, bloqueio ou eliminação
              nas hipóteses previstas em lei.
            </li>

            <li>
              Portabilidade, quando aplicável.
            </li>

            <li>
              Informações sobre compartilhamento.
            </li>

            <li>
              Revogação do consentimento, quando
              essa for a base legal utilizada.
            </li>

            <li>
              Oposição ao tratamento nas situações
              previstas em lei.
            </li>
          </ul>
        </section>

        <section>
          <h2>11. Solicitações de privacidade</h2>

          <p>
            Para solicitar acesso, correção, exclusão
            ou informações sobre o tratamento de dados
            pessoais, entre em contato pelo e-mail:
          </p>

          <p>
            <a
              href={`mailto:${contactEmail}?subject=Solicita%C3%A7%C3%A3o%20de%20Privacidade%20-%20MirraCRM`}
              style={{
                color: '#38bdf8',
                fontWeight: 700,
              }}
            >
              {contactEmail}
            </a>
          </p>

          <p>
            Informe o tipo de solicitação e os dados
            necessários para localizar o registro
            envolvido. Não envie senhas.
          </p>

          <p>
            Quando necessário, poderão ser solicitadas
            informações proporcionais para confirmar
            a identidade do solicitante.
          </p>

          <p>
            Se os dados tiverem sido inseridos por
            uma empresa cliente, a solicitação poderá
            ser encaminhada ao respectivo controlador,
            com a assistência cabível do MirraCRM.
          </p>

          <p>
            As solicitações serão avaliadas e atendidas
            nos termos da legislação aplicável.
          </p>
        </section>

        <section>
          <h2>
            12. Exclusão de dados relacionados à Meta
            e ao WhatsApp
          </h2>

          <p>
            Solicitações de exclusão de dados relacionados
            à integração com a Meta e o WhatsApp Business
            podem ser encaminhadas para:
          </p>

          <p>
            <a
              href={`mailto:${contactEmail}?subject=Exclus%C3%A3o%20de%20Dados%20-%20WhatsApp%20MirraCRM`}
              style={{
                color: '#38bdf8',
                fontWeight: 700,
              }}
            >
              {contactEmail}
            </a>
          </p>

          <p>
            O solicitante poderá informar o número
            de telefone ou a conta relacionada ao
            pedido, sem fornecer senhas.
          </p>

          <p>
            O MirraCRM verificará quais informações
            estão sob sua responsabilidade e quais
            dependem de providências do cliente
            controlador ou da própria Meta.
          </p>

          <p>
            A exclusão de dados armazenados no MirraCRM
            não implica necessariamente a exclusão
            automática de cópias mantidas pela Meta,
            por outros participantes da conversa
            ou por serviços independentes.
          </p>
        </section>

        <section>
          <h2>13. Transferências internacionais</h2>

          <p>
            A utilização de prestadores de tecnologia
            e serviços da Meta poderá envolver
            tratamento de dados em outros países.
          </p>

          <p>
            Quando houver transferência internacional
            de dados pessoais, deverão ser observados
            os requisitos legais e os mecanismos
            de proteção aplicáveis.
          </p>
        </section>

        <section>
          <h2>14. Crianças e adolescentes</h2>

          <p>
            O MirraCRM é destinado à gestão de atividades
            comerciais e não foi desenvolvido
            especificamente para crianças.
          </p>

          <p>
            Os usuários devem observar as exigências
            legais aplicáveis caso realizem o tratamento
            de dados pessoais de crianças ou adolescentes,
            considerando seu melhor interesse.
          </p>
        </section>

        <section>
          <h2>15. Atualizações desta política</h2>

          <p>
            Esta Política de Privacidade poderá ser
            atualizada para refletir mudanças nas
            funcionalidades, nos processos de tratamento,
            nos fornecedores ou nas exigências legais.
          </p>

          <p>
            A versão vigente será disponibilizada
            nesta página com sua data de atualização.
          </p>
        </section>

        <section>
          <h2>16. Contato</h2>

          <p>
            <strong>MirraCRM</strong>
            <br />
            Responsável: José Carlos Vignola
            <br />
            E-mail:{' '}
            <a href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
          </p>
        </section>

        <footer
          style={{
            borderTop: '1px solid #334155',
            marginTop: 48,
            paddingTop: 24,
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          © 2026 MirraCRM — Política de Privacidade.
        </footer>
      </article>
    </main>
  );
}
