require 'websocket-client-simple'

class Recorder
  def initialize(protocol: 'ws', host: 'localhost', port: '18080', path: '/')
    @protocol = protocol
    @host = host
    @port = port
    @path = path
    @url = "#{@protocol}://#{@host}:#{@port}#{@path}"
  end

  def listen
    WebSocket::Client::Simple.connect @url do |ws|
      ws.on :open do
        puts "connect!"
      end

      ws.on :message do |msg|
        puts msg.data
      end
    end
  end
end

recorder = Recorder.new(
  protocol: ENV.fetch('PROTOCOL', 'ws'),
  host: ENV.fetch('HOST', 'localhost'),
  port: ENV.fetch('PORT', '18080'),
  path: ENV.fetch('PATH', '/'),
)
recorder.listen