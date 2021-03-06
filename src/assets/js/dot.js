/*
 * @Description: 封装加埋点的类
 * @Author: 周鹏飞
 * @Date: 2019-09-29 18:21:53
 * @LastEditTime: 2019-10-01 14:17:36
 * 眼球曝光埋点和区域展现埋点：show-dot 点击埋点(包括评论，收藏，点赞)： clstag-dot
 */
/*  */
export const dot = {
  default: {
    exposureItem: null, // 统计页面中需要添加眼球曝光埋点的DOM元素
    showExposureData: [], // 添加眼球曝光的埋点数据
    maxNum: 5, // 数据累计多少条上报一次
    time: 5000 // 多久上报一次，这里是5000ms
  },
  // 客户端基本信息
  params: {
    browser: navigator.userAgent, // 浏览器信息
    title: document.title, // 页面标题
    resolve: window.screen.width + 'x' + window.screen.height + '(px)', // 设备分辨率
    deviceType: null, // 设备类型
    language: navigator.language, // 客户端语言
    userId: '123456', // 用户唯一标识
    link: location.href // 页面链接
  },
  /**
     * @description: 区域展示埋点(广告或者某些需要加展示埋点的区域)
     */
  show: function () {
    // 如果页面中存在上一次没有提报表的埋点，先进行提报
    this.dotFromLocalStorage()
    // 注册客户端app webview的关闭生命钩子事件
    // this.beforeLeaveWebview()
    let that = this
    let timer
    let showExposureData = that.default.showExposureData
    let observer = new IntersectionObserver(function (entries) {
      entries.forEach((entry, index) => {
        // 这段逻辑，是每一个被观察的组件进入视窗时都会触发的
        if (entry.isIntersecting) {
          // 把进入视口的组件数据添加进待上报的数据对象中
          showExposureData.push(entry.target.attributes['show-dot'].value)
          // 清除当前定时器
          clearTimeout(timer)
          // 停止观察进入视口的组件
          observer.unobserve(entry.target)
          // 超过一定数量埋点，上报后会删除这一批
          if (showExposureData.length >= that.default.maxNum) {
            that.analytics('action=' + JSON.stringify(showExposureData))
            showExposureData.length = 0
          } else {
            if (showExposureData.length > 0) {
              // 有新的数据进来，但是不满足上报数量，n秒后也上报
              localStorage.setItem('showExposureData', JSON.stringify(showExposureData))
              timer = setTimeout(() => {
                that.analytics('action=' + JSON.stringify(showExposureData))
                showExposureData.length = 0
              }, that.default.time)
            }
          }
        }
      })
    }, {
      root: null, // 默认根节点是视口
      rootMargin: '0px',
      threshold: 1 // 全部进入视口才被观察  这个阈值介于0和1之间
    })
    that.default.exposureItem.forEach(item => {
      observer.observe(item) // 观察每一个进入视口的区域
    })
  },
  checkTime: function (i) {
    if (i < 10) {
      i = '0' + i
    }
    return i
  },
  /**
     * @description: 获取当前时间 YY-MM-DD-HH-MM-SS
     */
  showTime: function () {
    var myDate = new Date()
    var year = myDate.getFullYear()
    var month = myDate.getMonth() + 1
    var date = myDate.getDate()
    var h = myDate.getHours()
    var m = myDate.getMinutes()
    var s = myDate.getSeconds()
    m = this.checkTime(m)
    s = this.checkTime(s)
    h = this.checkTime(h)
    return year + '_' + month + '_' + date + '_' + h + ':' + m + ':' + s + '_'
  },
  /**
     * @description: 下载日志
     */
  logTxt: function (data, name) {
    var urlObject = window.URL || window.webkitURL || window
    var exportBlob = new Blob([data])
    var saveLink = document.createElementNS('http://www.w3.org/1999/xhtml', 'a')
    saveLink.href = urlObject.createObjectURL(exportBlob)
    saveLink.download = name
    saveLink.click()
  },
  /**
     * @description: 保存日志
     */
  saveFile: function (str) {
    var name = this.showTime() + 'log.txt'
    this.logTxt(str, name)
  },
  /**
     * @description: 页面启动日志埋点
     */
  dotPageReadyData: function () {
    this.default.exposureItem = document.querySelectorAll('.exposure-statistics')
    this.params.deviceType = this.getDeviceType() ? this.getDeviceType()[0] : 'pc'
    this.postPv(this.params)
  },
  /**
     * @description: 错误日志上报
     */
  postError: function () {
    let that = this
    window.onerror = function (msg, url, line, col, error) {
      let time = {
        timestamp: new Date().getTime() // 错误上报时间
      }
      let errData = {
        act: 'error', // 上报类型
        key: 'details_123_error',
        msg, // 错误的具体信息
        line, // 错误所在的行
        col, // 错误所在的列
        error // 具体的error对象
      }
      that.analytics(that.splicingStr(Object.assign({}, time, errData, that.params)))
    }
  },
  /**
     * @description: 点击统计埋点(命令式))
     * @param {obj} vue实例
     */
  clickExpDot: function (Vue) {
    let that = this
    Vue.directive('clstag-dot', {
      bind: function (el, binding, vnode) {
        el.addEventListener('click', (e) => {
          console.log(e)
          e.stopPropagation()
          let time = {
            timestamp: new Date().getTime()
          }
          let position = Object.create(null)
          position.clientX = e.clientX
          position.clientY = e.clientY
          position.pageX = e.pageX
          position.pageY = e.pageY
          let query = Object.assign({}, position, time, binding.value, that.params)
          that.analytics(that.splicingStr(query))
        }, false)
      }
    })
  },
  /**
     * @description: 上报pv
     * @param {obj} 需要上报的数据对象
     */
  postPv: function (action) {
    let time = {
      timestamp: new Date().getTime()
    }
    let loadTime = this.getAllTime()
    let newAction = Object.assign({}, loadTime, time, { act: 'ready', key: 'details_123_show' }, action)
    this.analytics(this.splicingStr(newAction))
  },
  /**
     * @description: 拼接字符串
     * @param {obj} 需要上报的数据对象
     */
  splicingStr: function (action) {
    let str = ''
    for (const key in action) {
      if (action.hasOwnProperty(key)) {
        str = str + key + '=' + action[key] + '&'
      }
    }
    str = str.substring(0, str.length - 1)
    return str
  },
  /**
     * @description: 获取设备类型
     * @return: 返回设备类型
     */
  getDeviceType: function () {
    let flag = navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i)
    return flag
  },
  /**
     * @description: 返回白屏时间,dom渲染完成时间,页面onload时间等
     * @return: 返回白屏时间,dom渲染完成时间,页面onload时间等
     */
  getAllTime: function () {
    let timing = performance.timing
    let start = timing.navigationStart
    let allloadtime = {
      dnsTime: 0, // DNS解析时间
      tcpTime: 0, // TCP建立连接时间
      firstPaintTime: 0, // 白屏时间
      domRenderTime: 0 // dom渲染完成时间
    }
    allloadtime.dnsTime = timing.domainLookupEnd - timing.domainLookupStart
    allloadtime.tcpTime = timing.connectEnd - timing.connectStart
    allloadtime.firstPaintTime = timing.responseStart - start
    allloadtime.domRenderTime = timing.domContentLoadedEventEnd - start
    return allloadtime
  },
  /**
     * @description: 把浏览器localStorage里面的剩余埋点数据上报
     */
  dotFromLocalStorage: function () {
    if (localStorage.getItem('showExposureData') != null) {
      this.analytics('action=' + localStorage.getItem('showExposureData'))
    }
    localStorage.removeItem('showExposureData')
  },
  // @用img发送请求的方法英文术语叫:image-beacon
  // 主要应用于只需要向服务器发送日志数据的场合，且无需服务器有消息体回应。比如收集访问者的统计信息。
  // 这样做和ajax请求的区别在于：
  // 1.只能是get请求，因此可发送的数据量有限。
  // 2.只关心数据是否发送到服务器，服务器不需要做出消息体响应。并且一般客户端也不需要做出响应。
  // 3.实现了跨域
  analytics: function (action) {
    this.saveFile(action);
    (new Image()).src = `https://mercury.jd.com/log.gif?${action}`
    localStorage.removeItem('showExposureData')
  }
}
